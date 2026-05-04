import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import ComputeWorker from '@/workers/gardenCompute.worker?worker';
import RenderWorker from '@/workers/gardenRender.worker?worker';
import { createPortal } from 'react-dom';
import { PlacedPlant, PlotSettings, PlacedStructure } from '@/types/garden';
import { getPlantById, plants as allPlantData } from '@/data/plants';
import { getStructureById } from '@/data/structures';
import { calculateShadeZones, getSunExposure } from '@/utils/sunCalculator';
import { getCompanionReason, categoryColors, categoryColorsDark } from '@/data/companionReasons';
import { X, ZoomIn, ZoomOut, Move, Lightbulb, Wand2, Download } from 'lucide-react';
import { GardenMinimap } from './GardenMinimap';
import { Input } from '@/components/ui/input';
import { suggestPlantsForBed } from '@/utils/bedPlantSuggestions';
import { useFavouritePlants } from '@/hooks/useFavouritePlants';

// Canvas helper: draw a rounded rectangle path
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const minR = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + minR, y);
  ctx.arcTo(x + w, y, x + w, y + h, minR);
  ctx.arcTo(x + w, y + h, x, y + h, minR);
  ctx.arcTo(x, y + h, x, y, minR);
  ctx.arcTo(x, y, x + w, y, minR);
  ctx.closePath();
}

// Module-level emoji glyph atlas — avoids repeated font-metric lookups and text
// rasterisation on every canvas frame. Keyed by "emoji_size".
// Uses OffscreenCanvas so this function works identically in Web Workers. (#8)
const emojiCache = new Map<string, OffscreenCanvas>();
function getCachedEmoji(emoji: string, size: number): OffscreenCanvas {
  const key = `${emoji}_${Math.round(size)}`;
  if (!emojiCache.has(key)) {
    const s = Math.ceil(size * 1.5); // extra padding so emoji aren't clipped
    const c = new OffscreenCanvas(s, s);
    const cx = c.getContext('2d');
    if (cx) {
      cx.font = `${size}px sans-serif`;
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText(emoji, s / 2, s / 2);
    }
    emojiCache.set(key, c);
  }
  return emojiCache.get(key)!;
}

// ── Context reset helper — ctx.reset() clears the canvas AND resets all state in one
// GPU op. Universally supported: Chrome 99+, Firefox 113+, Safari 17.4+. (#9)
function resetCtx(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D): void {
  (ctx as any).reset();
}

// ── Frame scheduler: prefers requestVideoFrameCallback (rVFC) for true vsync-aligned
// redraws; falls back to rAF on browsers that don't yet support rVFC. (#10)
type FrameId = number;
function scheduleFrame(fn: FrameRequestCallback): FrameId {
  const w = window as typeof window & { requestVideoFrameCallback?: (cb: FrameRequestCallback) => number };
  return w.requestVideoFrameCallback ? w.requestVideoFrameCallback(fn) : requestAnimationFrame(fn);
}
function cancelFrame(id: FrameId): void {
  const w = window as typeof window & { cancelVideoFrameCallback?: (id: number) => void };
  w.cancelVideoFrameCallback ? w.cancelVideoFrameCallback(id) : cancelAnimationFrame(id);
}

// ── Twemoji sprite cache ──────────────────────────────────────────────────────
// Loads plant emoji as GPU-resident ImageBitmap from the Twemoji CDN (CC BY 4.0).
// Falls back to getCachedEmoji (system font) on failure or when offline.
const twemojiCache = new Map<string, ImageBitmap>();
const twemojiErrors = new Set<string>();
const twemojiPending = new Map<string, Promise<void>>();

function getEmojiUrl(emoji: string): string {
  // Convert emoji to Twemoji PNG URL.
  // Strip variation selector U+FE0F; join remaining codepoints with '-'.
  const codepoints: string[] = [];
  for (const char of [...emoji]) {
    const cp = char.codePointAt(0);
    if (cp !== undefined && cp !== 0xFE0F) codepoints.push(cp.toString(16));
  }
  return `https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/${codepoints.join('-')}.png`;
}

function loadTwemoji(emoji: string): Promise<void> {
  if (twemojiCache.has(emoji) || twemojiErrors.has(emoji)) return Promise.resolve();
  if (twemojiPending.has(emoji)) return twemojiPending.get(emoji)!;
  const p = (async () => {
    try {
      const resp = await fetch(getEmojiUrl(emoji));
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      twemojiCache.set(emoji, await createImageBitmap(await resp.blob()));
    } catch {
      twemojiErrors.add(emoji); // use system-font fallback permanently
    } finally {
      twemojiPending.delete(emoji);
    }
  })();
  twemojiPending.set(emoji, p);
  return p;
}

async function preloadTwemojis(emojis: string[]): Promise<void> {
  await Promise.all(emojis.map(loadTwemoji));
}

// ── Custom plant sprite cache ─────────────────────────────────────────────────
// Plants can optionally supply a `sprite` path (relative to BASE_URL) to
// override the default Twemoji glyph with a hand-crafted SVG/PNG image.
const customSpriteCache = new Map<string, ImageBitmap>();
const customSpriteErrors = new Set<string>();
const customSpritePending = new Map<string, Promise<void>>();

function loadCustomSprite(relPath: string): Promise<void> {
  if (customSpriteCache.has(relPath) || customSpriteErrors.has(relPath)) return Promise.resolve();
  if (customSpritePending.has(relPath)) return customSpritePending.get(relPath)!;
  const url = `${import.meta.env.BASE_URL}${relPath}`;
  const p = (async () => {
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      customSpriteCache.set(relPath, await createImageBitmap(await resp.blob()));
    } catch {
      customSpriteErrors.add(relPath);
    } finally {
      customSpritePending.delete(relPath);
    }
  })();
  customSpritePending.set(relPath, p);
  return p;
}

// Path2D cache — rounded-rect paths at origin (0,0), keyed by "w_h_r".
// Reused via ctx.translate() so the GPU tessellation is computed once per geometry.
const path2DCache = new Map<string, Path2D>();
function getCachedPath2D(w: number, h: number, r: number): Path2D {
  const key = `${Math.round(w)}_${Math.round(h)}_${Math.round(r * 10)}`;
  if (!path2DCache.has(key)) {
    const p = new Path2D();
    const minR = Math.min(r, w / 2, h / 2);
    p.moveTo(minR, 0);
    p.arcTo(w, 0, w, h, minR);
    p.arcTo(w, h, 0, h, minR);
    p.arcTo(0, h, 0, 0, minR);
    p.arcTo(0, 0, w, 0, minR);
    p.closePath();
    path2DCache.set(key, p);
  }
  return path2DCache.get(key)!;
}

// ── Standalone build functions for computed garden data ──────────────────────────
// Extracted from useMemo so they can be called from idle callbacks, workers, or tests.

type CompanionInfo = {
  hasCompanion: boolean; hasEnemy: boolean;
  companionNames: string[]; enemyNames: string[]; reasons: string[];
};

function buildCompanionMap(plants: PlacedPlant[]): Map<string, CompanionInfo> {
  const map = new Map<string, CompanionInfo>();
  const radius = 3;
  for (const p of plants) {
    const pData = getPlantById(p.plantId);
    if (!pData) continue;
    let hasCompanion = false, hasEnemy = false;
    const companionNames: string[] = [], enemyNames: string[] = [], reasons: string[] = [];
    for (const other of plants) {
      if (other.id === p.id) continue;
      const dist = Math.abs(other.x - p.x) + Math.abs(other.y - p.y);
      if (dist > radius) continue;
      const oData = getPlantById(other.plantId);
      if (!oData) continue;
      if (pData.companions.includes(other.plantId) || oData.companions.includes(p.plantId)) {
        hasCompanion = true;
        if (!companionNames.includes(oData.name)) companionNames.push(oData.name);
        const reason = getCompanionReason(p.plantId, other.plantId);
        if (reason && !reasons.includes(reason)) reasons.push(reason);
      }
      if (pData.enemies.includes(other.plantId) || oData.enemies.includes(p.plantId)) {
        hasEnemy = true;
        if (!enemyNames.includes(oData.name)) enemyNames.push(oData.name);
        const reason = getCompanionReason(p.plantId, other.plantId);
        if (reason && !reasons.includes(reason)) reasons.push(reason);
      }
    }
    map.set(p.id, { hasCompanion, hasEnemy, companionNames, enemyNames, reasons });
  }
  return map;
}

function buildSpacingConflicts(plants: PlacedPlant[], cellSizeCm: number): Map<string, string[]> {
  const conflicts = new Map<string, string[]>();
  for (const p of plants) {
    const pData = getPlantById(p.plantId);
    if (!pData) continue;
    const spacingCells = Math.ceil(pData.spacingCm / cellSizeCm);
    const issues: string[] = [];
    for (const other of plants) {
      if (other.id === p.id || other.plantId !== p.plantId) continue;
      const dist = Math.sqrt(Math.pow(other.x - p.x, 2) + Math.pow(other.y - p.y, 2));
      if (dist > 0 && dist < spacingCells) {
        const actualCm = Math.round(dist * cellSizeCm);
        issues.push(`Too close to another ${pData.name} (${actualCm}cm, needs ${pData.spacingCm}cm)`);
      }
    }
    if (issues.length > 0) conflicts.set(p.id, issues);
  }
  return conflicts;
}

function buildSpatialBuckets(plants: PlacedPlant[]): Map<string, PlacedPlant[]> {
  const BUCKET = 6;
  const buckets = new Map<string, PlacedPlant[]>();
  for (const p of plants) {
    const bx = Math.floor(p.x / BUCKET);
    const by = Math.floor(p.y / BUCKET);
    const key = `${bx},${by}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(p);
  }
  return buckets;
}

// ── Worker-readiness note ────────────────────────────────────────────────────────
// The multi-pass rendering in drawMainRef (#5) operates purely on serialisable data
// (PlacedPlant[], PlotSettings, Map/Set results, ImageBitmap handles).
// To migrate to OffscreenCanvas + Worker (#3), the next step is:
//   1. transferControlToOffscreen() on mainCanvasRef
//   2. postMessage({ type: 'render', state: serialisedRenderState, bitmaps: [...] })
//      with ImageBitmap[] in the transfer list
//   3. Move drawMainRef logic into the worker, replacing getCachedEmoji with
//      OffscreenCanvas-based glyph generation (supported in workers)
// ────────────────────────────────────────────────────────────────────────────────
interface GardenGridProps {
  settings: PlotSettings;
  plants: PlacedPlant[];
  structures: PlacedStructure[];
  onPlacePlant: (plantId: string, x: number, y: number) => void;
  onRemovePlant: (id: string) => void;
  onMovePlantStart?: (id: string) => void;
  onMovePlant: (id: string, x: number, y: number) => void;
  onSelectPlant: (plant: PlacedPlant | null) => void;
  onPlaceStructure: (structureId: string, x: number, y: number) => void;
  onRemoveStructure: (id: string) => void;
  onResizeStructure: (id: string, widthCells: number, heightCells: number) => void;
  onMoveStructure: (id: string, x: number, y: number) => void;
  selectedPlantId: string | null;
  onFillPlantArea?: (plantId: string, x: number, y: number, w: number, h: number) => void;
  onSmartAutoFill?: (x: number, y: number, w: number, h: number, isContainer: boolean) => void;
  onSettingsChange?: (s: PlotSettings) => void;
  pendingPlantId?: string | null;
  pendingIsStructure?: boolean;
  onCancelPending?: () => void;
  structureMode?: boolean;
  showSunOverlay?: boolean;
  onShowSunOverlayChange?: (show: boolean) => void;
  isMobile?: boolean;
  /** When provided, the minimap + canvas layer controls are portalled into this element instead of overlaying the canvas. */
  controlsPortalRef?: { current: HTMLElement | null };
  /**
   * Writable ref assigned an async function that returns the garden as a PNG data URL.
   * Pass `scale > 1` (e.g. 3) for a high-resolution export suitable for PDF printing.
   * Defaults to the display-resolution canvas when scale is omitted or 1.
   */
  canvasExportRef?: React.MutableRefObject<((scale?: number) => Promise<string | null>) | null>;
}

interface DragTooltip {
  x: number;
  y: number;
  plantId: string;
  gridX: number;
  gridY: number;
}

export function GardenGrid({ settings, plants, structures, onPlacePlant, onRemovePlant, onMovePlantStart, onMovePlant, onSelectPlant, onPlaceStructure, onRemoveStructure, onResizeStructure, onMoveStructure, selectedPlantId, onFillPlantArea, onSmartAutoFill, onSettingsChange, pendingPlantId, pendingIsStructure, onCancelPending, structureMode: propStructureMode, showSunOverlay: propShowSunOverlay, onShowSunOverlayChange, isMobile, controlsPortalRef, canvasExportRef }: GardenGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  // Static layer cache: background + grid lines (only redrawn when geometry/theme changes)
  const staticCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const staticLayerKeyRef = useRef<string>('');
  const staticBitmapRef = useRef<ImageBitmap | null>(null);
  const staticBitmapKeyRef = useRef<string>('');
  const shadeMaskRef = useRef<OffscreenCanvas | null>(null);
  const shadeMaskZonesRef = useRef<Set<string> | null>(null);
  // Separate overlay canvas for the plant-resize preview (avoids repainting plants on every drag move)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [resizing, setResizing] = useState<{ id: string; startX: number; startY: number; startW: number; startH: number; edge: 'right' | 'bottom' | 'corner' } | null>(null);
  const [moving, setMoving] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [movingPlant, setMovingPlant] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const plantMoveCommittedRef = useRef<string | null>(null);
  const [internalShowSunOverlay, setInternalShowSunOverlay] = useState(propShowSunOverlay ?? true);
  const showSunOverlay = propShowSunOverlay ?? internalShowSunOverlay;
  const setShowSunOverlay = (show: boolean) => {
    setInternalShowSunOverlay(show);
    onShowSunOverlayChange?.(show);
  };
  const [showColorCoding, setShowColorCoding] = useState(true);
  const [showRotationOverlay, setShowRotationOverlay] = useState(false);
  const [newlyPlacedId, setNewlyPlacedId] = useState<string | null>(null);
  const [hoveredPlantId, setHoveredPlantId] = useState<string | null>(null);
  // Incremented each time a new batch of Twemoji sprites finishes loading,
  // which causes both canvas effects to re-run and repaint with the real glyphs.
  const [spriteVersion, setSpriteVersion] = useState(0);
  // Local selection drives resize handles & canvas highlight without opening the info panel.
  // Info panel only opens when the user explicitly clicks the ℹ button.
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  // Tooltip only shows when the user deliberately hovers the ℹ button on a plant tile
  const [infoTooltipId, setInfoTooltipId] = useState<string | null>(null);
  const [dragTooltip, setDragTooltip] = useState<DragTooltip | null>(null);
  const [internalStructureMode, setInternalStructureMode] = useState(false);

  const [editingStructure, setEditingStructure] = useState<string | null>(null);

  const { getFavouriteIds } = useFavouritePlants();
  const favouriteIds = getFavouriteIds();

  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panMode, setPanMode] = useState(false);
  const touchPanRef = useRef<{ id: number; x: number; y: number; dist?: number } | null>(null);

  // Scroll position for ruler measurements
  const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);
  const mainRafRef = useRef<number | null>(null);
  const overlayRafRef = useRef<number | null>(null);
  // rAF pending guards — if a frame is already queued, skip re-scheduling.
  // drawMainRef / drawOverlayRef hold the latest draw fn; the rAF reads them when it fires.
  const mainRafPendingRef = useRef(false);
  const overlayRafPendingRef = useRef(false);
  const drawMainRef = useRef<(() => void) | null>(null);
  const drawOverlayRef = useRef<(() => void) | null>(null);
  // Render worker — posts serialised state, receives back an ImageBitmap per frame. (#1)
  const renderWorkerRef = useRef<Worker | null>(null);
  const renderIdRef = useRef(0);
  // Dirty region tracking: grid-cell coords of cells changed since last frame. (#2)
  // When ≤16 cells are dirty and no full-canvas overlays are active, the draw pass
  // clips to the union of dirty rects so the GPU skips unaffected pixels.
  const dirtyRectsRef = useRef<{ x: number; y: number }[]>([]);
  const markDirty = useCallback((x: number, y: number) => {
    dirtyRectsRef.current.push({ x: Math.floor(x), y: Math.floor(y) });
  }, []);

  // Plant resize state
  const [plantResize, setPlantResize] = useState<{
    plantId: string;
    originalId: string;
    originX: number;
    originY: number;
    currentW: number;
    currentH: number;
    baseW: number;
    baseH: number;
    startMouseX: number;
    startMouseY: number;
    edge: 'right' | 'bottom' | 'corner';
  } | null>(null);

  const cellSize = settings.cellSizePx;
  const cellsPerUnit = settings.unit === 'meters' ? (100 / settings.cellSizeCm) : (30.48 / settings.cellSizeCm);
  const cols = Math.round(settings.widthM * cellsPerUnit);
  const rows = Math.round(settings.heightM * cellsPerUnit);
  const gridW = cols * cellSize;
  const gridH = rows * cellSize;

  const clampPan = useCallback((offset: { x: number; y: number }) => {
    const container = containerRef.current;
    if (!container) return offset;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    return {
      x: Math.min(0, Math.max(-(gridW - cw), offset.x)),
      y: Math.min(0, Math.max(-(gridH - ch), offset.y)),
    };
  }, [gridW, gridH]);

  // Sync external selectedPlantId (e.g. opened from journal) into local selection state
  useEffect(() => {
    setInternalSelectedId(selectedPlantId ?? null);
  }, [selectedPlantId]);

  const shadeZones = useMemo(
    () => calculateShadeZones(structures, settings, cols, rows),
    [structures, settings, cols, rows]
  );

  // ── Companion/spacing/bucket/occupied data — computed in a Web Worker (#4, #7)
  // Refs are initialised synchronously with the build functions so the first render
  // has full data immediately. The worker updates them asynchronously on each change.
  const companionMapRef     = useRef<Map<string, CompanionInfo>>(buildCompanionMap(plants));
  const spacingConflictsRef = useRef<Map<string, string[]>>(buildSpacingConflicts(plants, settings.cellSizeCm));
  const spatialBucketsRef   = useRef<Map<string, PlacedPlant[]>>(buildSpatialBuckets(plants));
  const occupiedCellsRef    = useRef<Uint8Array>(() => {
    const arr = new Uint8Array(cols * rows);
    for (const p of plants) {
      const cx = Math.floor(p.x), cy = Math.floor(p.y);
      if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) arr[cy * cols + cx] = 1;
    }
    return arr;
  });
  // Plain aliases so the draw loop reads cleanly.
  const companionMap     = companionMapRef.current;
  const spacingConflicts = spacingConflictsRef.current;
  const spatialBuckets   = spatialBucketsRef.current;
  const occupiedCells    = occupiedCellsRef.current;

  // Singleton compute worker — created once, reused for every plants/settings change.
  const computeWorkerRef = useRef<Worker | null>(null);
  useEffect(() => {
    const worker = new ComputeWorker();
    computeWorkerRef.current = worker;
    worker.onmessage = (e) => {
      const { companionMap: cmArr, spacingConflicts: scArr, spatialBuckets: sbArr, occupiedCells: oc } = e.data;
      companionMapRef.current     = new Map(cmArr);
      spacingConflictsRef.current = new Map(scArr);
      spatialBucketsRef.current   = new Map(sbArr);
      occupiedCellsRef.current    = new Uint8Array(oc.buffer ?? oc);
      // Repaint with updated companion/spacing data.
      if (!mainRafPendingRef.current) {
        mainRafPendingRef.current = true;
        mainRafRef.current = scheduleFrame(() => {
          mainRafRef.current = null;
          mainRafPendingRef.current = false;
          drawMainRef.current?.();
        });
      }
    };
    return () => { worker.terminate(); computeWorkerRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Send a compute request whenever plants or cell size changes.
  useEffect(() => {
    computeWorkerRef.current?.postMessage({
      type: 'compute',
      plants,
      cellSizeCm: settings.cellSizeCm,
      cols,
      rows,
    });
  }, [plants, settings.cellSizeCm, cols, rows]);

  // O(1) plant hit-test index — covers all cells in the plant's area for area-spanning plants
  const plantCellIndex = useMemo(() => {
    const map = new Map<string, PlacedPlant>();
    for (const p of plants) {
      const ax = Math.floor(p.x), ay = Math.floor(p.y);
      const aw = p.areaW ?? 1, ah = p.areaH ?? 1;
      for (let dy = 0; dy < ah; dy++) {
        for (let dx = 0; dx < aw; dx++) {
          map.set(`${ax + dx},${ay + dy}`, p);
        }
      }
    }
    return map;
  }, [plants]);

  // Memoised ruler label interval — was previously computed inline on every render.
  const labelInterval = useMemo(
    () => settings.unit === 'meters'
      ? Math.round(100 / settings.cellSizeCm)
      : Math.round(30.48 / settings.cellSizeCm),
    [settings.unit, settings.cellSizeCm]
  );

  const snapToGridFn = useCallback((clientX: number, clientY: number) => {
    if (!mainCanvasRef.current) return { x: 0, y: 0 };
    const rect = mainCanvasRef.current.getBoundingClientRect();
    const rawX = (clientX - rect.left) / cellSize;
    const rawY = (clientY - rect.top) / cellSize;
    if (settings.snapToGrid !== false) {
      const x = Math.floor(rawX);
      const y = Math.floor(rawY);
      return { x: Math.max(0, Math.min(x, cols - 1)), y: Math.max(0, Math.min(y, rows - 1)) };
    }
    // Free placement: round to 0.1 precision
    const x = Math.round(Math.max(0, Math.min(rawX, cols - 1)) * 10) / 10;
    const y = Math.round(Math.max(0, Math.min(rawY, rows - 1)) * 10) / 10;
    return { x, y };
  }, [cellSize, cols, rows, settings.snapToGrid]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    setDragTooltip(null);
    const plantId = e.dataTransfer.getData('plantId');
    const structureId = e.dataTransfer.getData('structureId');
    const { x, y } = snapToGridFn(e.clientX, e.clientY);
    if (structureId) {
      // Always snap structures to whole-cell boundaries
      onPlaceStructure(structureId, Math.round(x), Math.round(y));
    } else if (plantId) {
      markDirty(x, y);
      onPlacePlant(plantId, x, y);
    }
  }, [snapToGridFn, markDirty, onPlacePlant, onPlaceStructure]);

  useEffect(() => {
    if (plants.length > 0) {
      const newest = plants[plants.length - 1];
      setNewlyPlacedId(newest.id);
      const timer = setTimeout(() => setNewlyPlacedId(null), 400);
      return () => clearTimeout(timer);
    }
  }, [plants]);

  // Preload Twemoji + custom sprites for every unique plant on the grid.
  // When the batch finishes, increment spriteVersion to trigger a canvas redraw.
  useEffect(() => {
    const plantDatas = plants.map(p => getPlantById(p.plantId)).filter(Boolean);
    const emojis = [...new Set(plantDatas.map(p => p!.emoji))];
    const sprites = [...new Set(plantDatas.map(p => p!.sprite).filter((s): s is string => Boolean(s)))];
    if (emojis.length === 0 && sprites.length === 0) return;
    let cancelled = false;
    Promise.all([
      preloadTwemojis(emojis),
      ...sprites.map(loadCustomSprite),
    ]).then(() => { if (!cancelled) setSpriteVersion(v => v + 1); });
    return () => { cancelled = true; };
  }, [plants]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
    const { x, y } = snapToGridFn(e.clientX, e.clientY);
    const plantId = e.dataTransfer.getData('plantId') || '';
    setDragTooltip(plantId ? { x: e.clientX, y: e.clientY, plantId, gridX: x, gridY: y } : null);
  }, [snapToGridFn]);

  // Structure resize
  const handleResizeStart = useCallback((e: React.PointerEvent, structId: string, startW: number, startH: number, edge: 'right' | 'bottom' | 'corner') => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({ id: structId, startX: e.clientX, startY: e.clientY, startW, startH, edge });
  }, []);

  useEffect(() => {
    if (!resizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = Math.round((e.clientX - resizing.startX) / cellSize);
      const deltaY = Math.round((e.clientY - resizing.startY) / cellSize);
      let newW = resizing.startW;
      let newH = resizing.startH;
      if (resizing.edge === 'right' || resizing.edge === 'corner') newW = Math.max(1, resizing.startW + deltaX);
      if (resizing.edge === 'bottom' || resizing.edge === 'corner') newH = Math.max(1, resizing.startH + deltaY);
      onResizeStructure(resizing.id, newW, newH);
    };
    const handleMouseUp = () => setResizing(null);
    window.addEventListener('pointermove', handleMouseMove);
    window.addEventListener('pointerup', handleMouseUp);
    return () => { window.removeEventListener('pointermove', handleMouseMove); window.removeEventListener('pointerup', handleMouseUp); };
  }, [resizing, cellSize, onResizeStructure]);

  // Plant resize — drag handles to expand into a patch
  const handlePlantResizeStart = useCallback((e: React.PointerEvent, placed: PlacedPlant, edge: 'right' | 'bottom' | 'corner') => {
    e.preventDefault();
    e.stopPropagation();
    const baseW = placed.areaW ?? 1;
    const baseH = placed.areaH ?? 1;
    setPlantResize({
      plantId: placed.plantId,
      originalId: placed.id,
      originX: placed.x,
      originY: placed.y,
      currentW: baseW,
      currentH: baseH,
      baseW,
      baseH,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      edge,
    });
  }, []);

  useEffect(() => {
    if (!plantResize) return;
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = Math.round((e.clientX - plantResize.startMouseX) / cellSize);
      const deltaY = Math.round((e.clientY - plantResize.startMouseY) / cellSize);
      let newW = plantResize.baseW;
      let newH = plantResize.baseH;
      if (plantResize.edge === 'right' || plantResize.edge === 'corner') newW = Math.max(1, plantResize.baseW + deltaX);
      if (plantResize.edge === 'bottom' || plantResize.edge === 'corner') newH = Math.max(1, plantResize.baseH + deltaY);
      newW = Math.min(newW, cols - plantResize.originX);
      newH = Math.min(newH, rows - plantResize.originY);
      setPlantResize(prev => prev ? { ...prev, currentW: newW, currentH: newH } : null);
    };
    const handleMouseUp = () => {
      if (plantResize && onFillPlantArea) {
        const sizeChanged = plantResize.currentW !== plantResize.baseW || plantResize.currentH !== plantResize.baseH;
        const hasMeaningfulArea = plantResize.currentW > 1 || plantResize.currentH > 1;
        if (sizeChanged || hasMeaningfulArea) {
          // Remove the original single-cell / previous-area plant so it's replaced cleanly
          onRemovePlant(plantResize.originalId);
          onFillPlantArea(plantResize.plantId, plantResize.originX, plantResize.originY, plantResize.currentW, plantResize.currentH);
        }
      }
      setPlantResize(null);
    };
    window.addEventListener('pointermove', handleMouseMove);
    window.addEventListener('pointerup', handleMouseUp);
    return () => { window.removeEventListener('pointermove', handleMouseMove); window.removeEventListener('pointerup', handleMouseUp); };
  }, [plantResize, cellSize, cols, rows, onFillPlantArea, onRemovePlant]);

  const handleMoveStart = useCallback((e: React.PointerEvent, structId: string, origX: number, origY: number) => {
    // Only allow moving structures when in structure mode
    if (!propStructureMode) return;
    e.preventDefault();
    e.stopPropagation();
    setMoving({ id: structId, startX: e.clientX, startY: e.clientY, origX, origY });
  }, [propStructureMode]);

  useEffect(() => {
    if (!moving) return;
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = Math.round((e.clientX - moving.startX) / cellSize);
      const deltaY = Math.round((e.clientY - moving.startY) / cellSize);
      // Snap to grid: ensure structure positions are always whole-cell values
      const struct = structures.find(s => s.id === moving.id);
      const w = struct?.widthCells ?? 1;
      const h = struct?.heightCells ?? 1;
      const newX = Math.max(0, Math.min(Math.round(moving.origX + deltaX), cols - w));
      const newY = Math.max(0, Math.min(Math.round(moving.origY + deltaY), rows - h));
      onMoveStructure(moving.id, newX, newY);
    };
    const handleMouseUp = () => setMoving(null);
    window.addEventListener('pointermove', handleMouseMove);
    window.addEventListener('pointerup', handleMouseUp);
    return () => { window.removeEventListener('pointermove', handleMouseMove); window.removeEventListener('pointerup', handleMouseUp); };
  }, [moving, cellSize, onMoveStructure, structures, cols, rows]);

  const handlePlantMoveStart = useCallback((e: React.PointerEvent, plantId: string, origX: number, origY: number) => {
    if (panMode) return;
    // Only allow moving plants when NOT in structure mode
    if (propStructureMode) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-no-plant-move="true"]')) return;
    e.preventDefault();
    e.stopPropagation();
    plantMoveCommittedRef.current = null;
    setMovingPlant({ id: plantId, startX: e.clientX, startY: e.clientY, origX, origY });
  }, [panMode, propStructureMode]);

  useEffect(() => {
    if (!movingPlant) return;

    const handleMouseMove = (e: MouseEvent) => {
      const { x, y } = snapToGridFn(e.clientX, e.clientY);
      const positionChanged = x !== movingPlant.origX || y !== movingPlant.origY;

      if (!positionChanged) return;

      if (!plantMoveCommittedRef.current) {
        onMovePlantStart?.(movingPlant.id);
        plantMoveCommittedRef.current = movingPlant.id;
      }

      onMovePlant(movingPlant.id, x, y);
    };

    const handleMouseUp = () => {
      plantMoveCommittedRef.current = null;
      setMovingPlant(null);
    };

    window.addEventListener('pointermove', handleMouseMove);
    window.addEventListener('pointerup', handleMouseUp);

    return () => {
      window.removeEventListener('pointermove', handleMouseMove);
      window.removeEventListener('pointerup', handleMouseUp);
    };
  }, [movingPlant, onMovePlant, onMovePlantStart, snapToGridFn]);

  // Panning with middle mouse or pan mode
  const handlePanStart = useCallback((e: React.PointerEvent) => {
    if (e.button === 1 || panMode) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  }, [panMode, panOffset]);

  useEffect(() => {
    if (!isPanning) return;
    const handleMouseMove = (e: MouseEvent) => {
      setPanOffset(clampPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y }));
    };
    const handleMouseUp = () => setIsPanning(false);
    window.addEventListener('pointermove', handleMouseMove);
    window.addEventListener('pointerup', handleMouseUp);
    return () => { window.removeEventListener('pointermove', handleMouseMove); window.removeEventListener('pointerup', handleMouseUp); };
  }, [isPanning, panStart, clampPan]);

  // Keyboard shortcuts: arrow keys to pan, +/- to zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const PAN_STEP = 50;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          setPanOffset(prev => clampPan({ x: prev.x + PAN_STEP, y: prev.y }));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setPanOffset(prev => clampPan({ x: prev.x - PAN_STEP, y: prev.y }));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setPanOffset(prev => clampPan({ x: prev.x, y: prev.y + PAN_STEP }));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setPanOffset(prev => clampPan({ x: prev.x, y: prev.y - PAN_STEP }));
          break;
        case '+':
        case '=': {
          e.preventDefault();
          const newSize = Math.min(64, cellSize + 4);
          if (onSettingsChange && newSize !== cellSize) {
            const ratio = newSize / cellSize;
            const container = containerRef.current;
            if (container) {
              const cw = container.clientWidth, ch = container.clientHeight;
              const newGridW = cols * newSize, newGridH = rows * newSize;
              setPanOffset(prev => ({
                x: Math.min(0, Math.max(-(newGridW - cw), prev.x - (cw / 2) * (ratio - 1))),
                y: Math.min(0, Math.max(-(newGridH - ch), prev.y - (ch / 2) * (ratio - 1))),
              }));
            }
            onSettingsChange({ ...settings, cellSizePx: newSize });
          }
          break;
        }
        case '-':
        case '_': {
          e.preventDefault();
          const newSize = Math.max(16, cellSize - 4);
          if (onSettingsChange && newSize !== cellSize) {
            const ratio = newSize / cellSize;
            const container = containerRef.current;
            if (container) {
              const cw = container.clientWidth, ch = container.clientHeight;
              const newGridW = cols * newSize, newGridH = rows * newSize;
              setPanOffset(prev => ({
                x: Math.min(0, Math.max(-(newGridW - cw), prev.x - (cw / 2) * (ratio - 1))),
                y: Math.min(0, Math.max(-(newGridH - ch), prev.y - (ch / 2) * (ratio - 1))),
              }));
            }
            onSettingsChange({ ...settings, cellSizePx: newSize });
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clampPan, cellSize, settings, onSettingsChange, cols, rows]);

  // Scroll wheel: Ctrl/Cmd+scroll zooms anchored at the cursor position; plain scroll pans.
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -4 : 4;
      const newSize = Math.max(16, Math.min(64, cellSize + delta));
      if (onSettingsChange && newSize !== cellSize) {
        const ratio = newSize / cellSize;
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          // Keep the garden point under the cursor fixed after zoom
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          const newGridW = cols * newSize;
          const newGridH = rows * newSize;
          const cw = containerRef.current!.clientWidth;
          const ch = containerRef.current!.clientHeight;
          setPanOffset(prev => ({
            x: Math.min(0, Math.max(-(newGridW - cw), prev.x - mx * (ratio - 1))),
            y: Math.min(0, Math.max(-(newGridH - ch), prev.y - my * (ratio - 1))),
          }));
        }
        onSettingsChange({ ...settings, cellSizePx: newSize });
      }
    } else {
      e.preventDefault();
      setPanOffset(prev => clampPan({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  }, [cellSize, settings, onSettingsChange, clampPan, cols, rows]);

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  // Memoised theme colours — reads CSS variables once per theme change instead of every frame.
  const themeColors = useMemo(() => {
    const cssStyle = getComputedStyle(document.documentElement);
    const cardVal = cssStyle.getPropertyValue('--card').trim();
    const primaryVal = cssStyle.getPropertyValue('--primary').trim();
    return {
      bgColor: cardVal ? `hsl(${cardVal})` : (isDark ? '#111' : '#fff'),
      primaryColor: primaryVal ? `hsl(${primaryVal})` : '#22c55e',
    };
  }, [isDark]);

  // ─── Render worker setup ─────────────────────────────────────────────────────
  // Singleton worker; recreated only on mount/unmount. The onmessage handler blits
  // received ImageBitmaps onto the real canvas element. (#1)
  useEffect(() => {
    const worker = new RenderWorker();
    renderWorkerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      if (e.data.type === 'sprites-ready') {
        // New Twemoji/sprite bitmaps loaded inside the worker — request a repaint.
        if (!mainRafPendingRef.current) {
          mainRafPendingRef.current = true;
          mainRafRef.current = scheduleFrame(() => {
            mainRafRef.current = null;
            mainRafPendingRef.current = false;
            drawMainRef.current?.();
          });
        }
        return;
      }
      if (e.data.type !== 'frame') return;
      const { id, bitmap } = e.data as { type: 'frame'; id: number; bitmap: ImageBitmap };
      // Discard stale frames from superseded render requests.
      if (id !== renderIdRef.current) { bitmap.close(); return; }

      const canvas = mainCanvasRef.current;
      if (!canvas) { bitmap.close(); return; }

      // Resize canvas to match the rendered bitmap dimensions.
      if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        // bitmap is always at DPR 2×; derive CSS size from that.
        canvas.style.width = `${bitmap.width / 2}px`;
        canvas.style.height = `${bitmap.height / 2}px`;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) { bitmap.close(); return; }
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
    };

    // Trigger the first render once the worker is ready.
    drawMainRef.current?.();

    return () => {
      worker.terminate();
      renderWorkerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Main canvas renderer ────────────────────────────────────────────────────
  // Captures the latest render state into drawMainRef so the rAF can post it to
  // the render worker. Falls back to main-thread drawing before the worker is ready.
  // Plant-resize preview lives on the separate overlay canvas.
  useEffect(() => {
    // Always capture the latest draw logic so the rAF callback calls a fresh closure.
    drawMainRef.current = () => {
      const canvas = mainCanvasRef.current;
      if (!canvas) return;
      // ── Viewport culling bounds (shared by worker path and fallback). (#3)
      const container = containerRef.current;
      const containerW = container?.clientWidth ?? gridW;
      const containerH = container?.clientHeight ?? gridH;
      const vpLeft   = Math.max(0,    Math.floor(-panOffset.x / cellSize) - 1);
      const vpTop    = Math.max(0,    Math.floor(-panOffset.y / cellSize) - 1);
      const vpRight  = Math.min(cols, Math.ceil((-panOffset.x + containerW) / cellSize) + 1);
      const vpBottom = Math.min(rows, Math.ceil((-panOffset.y + containerH) / cellSize) + 1);

      // ── Render worker path — serialise state, let worker draw all 6 passes,
      //    receive back an ImageBitmap, and blit it here. (#1)
      if (renderWorkerRef.current) {
        renderIdRef.current++;
        renderWorkerRef.current.postMessage({
          type: 'render',
          id: renderIdRef.current,
          gridW, gridH, cols, rows, cellSize, isDark, themeColors,
          plants, structures,
          shadeZonesArr: [...shadeZones],
          showSunOverlay, showRotationOverlay, showColorCoding,
          companionMapEntries: [...companionMapRef.current.entries()],
          spacingConflictsEntries: [...spacingConflictsRef.current.entries()],
          spatialBucketsEntries: [...spatialBucketsRef.current.entries()],
          baseUrl: import.meta.env.BASE_URL,
          vpLeft, vpTop, vpRight, vpBottom,
        });
        return; // Worker posts an ImageBitmap back via onmessage; handler blits it.
      }

      // ── Fallback: draw directly on main thread (worker not yet initialised). ──
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

    // 1. Cap DPR at 2× — visually imperceptible above 2× for grid content,
    //    but saves 9× memory on 3× screens (e.g. large 50×50 garden at 32px/cell).
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const inViewport = (px: number, py: number) =>
      px >= vpLeft && px < vpRight && py >= vpTop && py < vpBottom;
    const targetW = gridW * dpr, targetH = gridH * dpr;
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      canvas.style.width = `${gridW}px`;
      canvas.style.height = `${gridH}px`;
    }
    // ── Dirty region tracking — when only a handful of cells changed, clip the
    //    context to the union of dirty rects so the GPU rejects unaffected pixels.
    //    Skip partial repaint when full-canvas overlays (shade/rotation) are active
    //    because they fill the entire canvas and require a full clear. (#2)
    const dirtyRects = dirtyRectsRef.current;
    dirtyRectsRef.current = [];
    const usePartialRepaint =
      dirtyRects.length > 0 && dirtyRects.length <= 16 &&
      !showSunOverlay && !showRotationOverlay;

    if (usePartialRepaint) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Clear only the dirty cells (with arc-radius padding for companion lines).
      const pad = cellSize * 2;
      for (const { x, y } of dirtyRects) {
        ctx.clearRect(x * cellSize - pad, y * cellSize - pad, cellSize + pad * 2, cellSize + pad * 2);
      }
      // Restore the static layer in cleared areas by blitting the cached background.
      if (staticBitmapRef.current && staticBitmapKeyRef.current === `${gridW},${gridH},${cols},${rows},${cellSize},${themeColors.bgColor}`) {
        ctx.save();
        ctx.beginPath();
        for (const { x, y } of dirtyRects) {
          ctx.rect(x * cellSize - pad, y * cellSize - pad, cellSize + pad * 2, cellSize + pad * 2);
        }
        ctx.clip();
        ctx.drawImage(staticBitmapRef.current, 0, 0, gridW, gridH);
        ctx.restore();
      }
      // Clip all subsequent drawing to the dirty region.
      ctx.save();
      ctx.beginPath();
      for (const { x, y } of dirtyRects) {
        ctx.rect(x * cellSize - pad, y * cellSize - pad, cellSize + pad * 2, cellSize + pad * 2);
      }
      ctx.clip();
    } else {
      resetCtx(ctx);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // 2. Clip to canvas border-radius (matches Tailwind rounded-lg = 8px).
      ctx.save();
      roundRect(ctx, 0, 0, gridW, gridH, 8);
      ctx.clip();
    }

    const { bgColor, primaryColor } = themeColors;

    // 3. Static layer: background + grid lines (skipped during partial repaint — already blitted above).
    //    Cached in a hidden HTMLCanvasElement; only redrawn when geometry or theme changes.
    const staticKey = `${gridW},${gridH},${cols},${rows},${cellSize},${bgColor}`;
    if (!staticCanvasRef.current || staticLayerKeyRef.current !== staticKey) {
      const sl = document.createElement('canvas');
      sl.width = gridW * dpr;
      sl.height = gridH * dpr;
      const sCtx = sl.getContext('2d') as CanvasRenderingContext2D | null;
      if (sCtx) {
        sCtx.scale(dpr, dpr);
        // Background
        sCtx.fillStyle = bgColor;
        sCtx.fillRect(0, 0, gridW, gridH);
        // Minor grid lines (every cell, skip multiples of 5)
        sCtx.beginPath();
        sCtx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
        sCtx.lineWidth = 0.5;
        for (let c = 1; c < cols; c++) {
          if (c % 5 === 0) continue;
          sCtx.moveTo(c * cellSize, 0); sCtx.lineTo(c * cellSize, gridH);
        }
        for (let r = 1; r < rows; r++) {
          if (r % 5 === 0) continue;
          sCtx.moveTo(0, r * cellSize); sCtx.lineTo(gridW, r * cellSize);
        }
        sCtx.stroke();
        // Major grid lines (every 5 cells)
        sCtx.beginPath();
        sCtx.strokeStyle = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)';
        sCtx.lineWidth = 1;
        for (let c = 5; c <= cols; c += 5) {
          sCtx.moveTo(c * cellSize, 0); sCtx.lineTo(c * cellSize, gridH);
        }
        for (let r = 5; r <= rows; r += 5) {
          sCtx.moveTo(0, r * cellSize); sCtx.lineTo(gridW, r * cellSize);
        }
        sCtx.stroke();
      }
      staticCanvasRef.current = sl;
      staticLayerKeyRef.current = staticKey;
    }
    if (!usePartialRepaint) {
      if (staticBitmapRef.current && staticBitmapKeyRef.current === staticKey) {
        ctx.drawImage(staticBitmapRef.current, 0, 0, gridW, gridH);
      } else {
        ctx.drawImage(staticCanvasRef.current, 0, 0, gridW, gridH);
        // Asynchronously upgrade to a GPU-resident ImageBitmap for subsequent frames.
        const capturedKey = staticKey;
        createImageBitmap(staticCanvasRef.current).then(bm => {
          if (staticLayerKeyRef.current === capturedKey) {
            staticBitmapRef.current?.close();
            staticBitmapRef.current = bm;
            staticBitmapKeyRef.current = capturedKey;
          } else {
            bm.close();
          }
        });
      }
    }

    // 4. Structure cell fills on canvas — replaces a grid of absolutely-positioned DOM divs.
    //    For a 10×10 structure this eliminated 100 DOM nodes; for multiple structures, hundreds.
    for (const struct of structures) {
      const data = getStructureById(struct.structureId);
      if (!data?.showCells) continue;
      ctx.fillStyle = data.color;
      ctx.globalAlpha = 0.4;
      for (let row = 0; row < struct.heightCells; row++) {
        for (let col = 0; col < struct.widthCells; col++) {
          roundRect(ctx,
            (struct.x + col) * cellSize + 1,
            (struct.y + row) * cellSize + 1,
            cellSize - 2, cellSize - 2, 2
          );
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    // 5. Sun/shade overlay — rendered once to an OffscreenCanvas; blurred on composite
    //    for a smooth, physically-plausible shadow gradient. (#9)
    if (showSunOverlay && shadeZones.size > 0) {
      if (shadeMaskZonesRef.current !== shadeZones || !shadeMaskRef.current
          || shadeMaskRef.current.width !== gridW || shadeMaskRef.current.height !== gridH) {
        const mask = new OffscreenCanvas(gridW, gridH);
        const sCtx = mask.getContext('2d') as OffscreenCanvasRenderingContext2D;
        const exposureColorMap: Record<string, string> = {
          'full-sun': 'hsla(45,100%,60%,0.30)',
          'partial-shade': 'hsla(200,60%,60%,0.25)',
          'full-shade': 'hsla(220,20%,50%,0.30)',
        };
        const byExposure = new Map<string, Array<[number, number]>>();
        for (const key of shadeZones) {
          const [sx, sy] = key.split(',').map(Number);
          const exposure = getSunExposure(sx, sy, shadeZones);
          if (!byExposure.has(exposure)) byExposure.set(exposure, []);
          byExposure.get(exposure)!.push([sx, sy]);
        }
        for (const [exposure, cells] of byExposure) {
          sCtx.fillStyle = exposureColorMap[exposure] ?? 'transparent';
          for (const [sx, sy] of cells) {
            sCtx.fillRect(sx * cellSize, sy * cellSize, cellSize, cellSize);
          }
        }
        shadeMaskRef.current = mask;
        shadeMaskZonesRef.current = shadeZones;
      }
      const blurPx = Math.max(Math.round(cellSize * 0.55), 3);
      ctx.filter = `blur(${blurPx}px)`;
      ctx.drawImage(shadeMaskRef.current, 0, 0);
      ctx.filter = 'none';
    }

    // 6. Rotation heatmap — batched by rotation group to minimise fillStyle changes.
    if (showRotationOverlay && plants.length > 0) {
      const RC: Record<string, string> = {
        legumes: 'rgba(134,239,172,0.5)', brassicas: 'rgba(196,181,253,0.5)',
        roots: 'rgba(253,186,116,0.5)', alliums: 'rgba(253,224,71,0.5)',
        solanaceae: 'rgba(252,165,165,0.5)', cucurbits: 'rgba(103,232,249,0.5)',
        leafy: 'rgba(167,243,208,0.5)', other: 'rgba(203,213,225,0.5)',
      };
      const byGroup = new Map<string, PlacedPlant[]>();
      for (const plant of plants) {
        const pData = getPlantById(plant.plantId);
        if (!pData) continue;
        const group = pData.rotationGroup ?? 'other';
        if (!byGroup.has(group)) byGroup.set(group, []);
        byGroup.get(group)!.push(plant);
      }
      for (const [group, groupPlants] of byGroup) {
        ctx.fillStyle = RC[group] ?? RC.other;
        for (const plant of groupPlants) {
          if (!inViewport(Math.floor(plant.x), Math.floor(plant.y))) continue;
          ctx.fillRect(Math.floor(plant.x) * cellSize, Math.floor(plant.y) * cellSize, cellSize, cellSize);
        }
      }
    }

    // 7. Plant tiles — multi-pass batched rendering (#5)
    //    Pass A: normal tile fills (no shadow) — batch by bg colour → one fill() per colour group
    //    Pass B: highlighted tile fills (shadow) — individual save/restore
    //    Pass C: all emoji in one drawImage sweep
    //    Pass D: name labels (font set once)
    //    Pass E: stage badges (font set once)
    //    Pass F: bottom badges (variable styles, per-plant)
    const hasLabel = cellSize >= 28;
    const tilePath = getCachedPath2D(cellSize - 2, cellSize - 2, 5);
    const sortedPlants = [...plants].sort((a, b) => {
      const aData = getPlantById(a.plantId);
      const bData = getPlantById(b.plantId);
      return (aData?.category ?? '').localeCompare(bData?.category ?? '');
    });

    // Pre-compute per-plant metadata used across passes
    interface TileMeta {
      placed: PlacedPlant;
      plantData: ReturnType<typeof getPlantById>;
      px: number; py: number; pw: number; ph: number;
      tileBg: string;
      hasHighlight: boolean;
      relations: { hasCompanion: boolean; hasEnemy: boolean; companionNames: string[]; enemyNames: string[]; reasons: string[] } | undefined;
      spacingIssues: string[] | undefined;
      growthPct: number;
      emojiSize: number;
      emojiOffsetY: number;
    }
    const tileMetas: TileMeta[] = [];
    for (const placed of sortedPlants) {
      const plantData = getPlantById(placed.plantId);
      if (!plantData) continue;
      const aw = placed.areaW ?? 1, ah = placed.areaH ?? 1;
      const ax = Math.floor(placed.x), ay = Math.floor(placed.y);
      // Viewport: any part of the area must be visible
      if (ax + aw <= vpLeft || ax >= vpRight || ay + ah <= vpTop || ay >= vpBottom) continue;
      const relations = companionMap.get(placed.id);
      const spacingIssues = spacingConflicts.get(placed.id);
      const catColor = showColorCoding
        ? (isDark ? categoryColorsDark[plantData.category] : categoryColors[plantData.category])
        : undefined;
      const tileBg = isDark
        ? (relations?.hasEnemy ? 'hsl(0 30% 14%)' : relations?.hasCompanion ? 'hsl(142 25% 14%)' : catColor || 'hsl(25 20% 12%)')
        : (relations?.hasEnemy ? 'hsl(0 60% 95%)' : relations?.hasCompanion ? 'hsl(142 40% 93%)' : catColor || 'hsl(25 30% 94%)');
      const hasHighlight = Boolean(relations?.hasEnemy || relations?.hasCompanion || spacingIssues?.length);
      const px = ax * cellSize, py = ay * cellSize;
      const pw = aw * cellSize, ph = ah * cellSize;
      const daysSincePlanted = placed.plantedAt
        ? Math.floor((Date.now() - new Date(placed.plantedAt).getTime()) / 86400000) : 0;
      const daysToHarvest = plantData.daysToHarvest ?? 90;
      const isEstablished = placed.stage === 'established';
      const growthPct = isEstablished ? 1 : placed.stage === 'seedling' ? 0.3 : Math.min(1, daysSincePlanted / daysToHarvest);
      // For area plants: emoji fills most of the shorter dimension; for single cells: fixed scale
      const emojiSize = aw > 1 || ah > 1
        ? Math.max(Math.min(pw, ph) * 0.82, 20)
        : Math.max(cellSize * (0.88 + Math.min(0.1, growthPct * 0.1)), 20);
      const emojiOffsetY = aw > 1 || ah > 1 ? 0 : (hasLabel ? -3 : 0);
      tileMetas.push({ placed, plantData, px, py, pw, ph, tileBg, hasHighlight, relations, spacingIssues, growthPct, emojiSize, emojiOffsetY });
    }

    // Pass A: normal (no-shadow) tile fills — group by bg colour for minimal fillStyle changes
    const normalByBg = new Map<string, TileMeta[]>();
    for (const m of tileMetas) {
      if (m.hasHighlight) continue;
      if (!normalByBg.has(m.tileBg)) normalByBg.set(m.tileBg, []);
      normalByBg.get(m.tileBg)!.push(m);
    }
    for (const [bg, group] of normalByBg) {
      ctx.fillStyle = bg;
      ctx.shadowColor = 'rgba(0,0,0,0.10)'; ctx.shadowBlur = 2;
      ctx.beginPath();
      for (const { px, py, pw, ph } of group) roundRect(ctx, px + 1, py + 1, pw - 2, ph - 2, 5);
      ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    }

    // Pass B: highlighted tile fills (enemy/companion/spacing) — shadow requires per-tile save/restore
    for (const { px, py, pw, ph, tileBg, relations, spacingIssues } of tileMetas) {
      if (!relations?.hasEnemy && !relations?.hasCompanion && !spacingIssues?.length) continue;
      ctx.save();
      ctx.translate(px + 1, py + 1);
      if (relations?.hasEnemy) { ctx.shadowColor = 'rgba(239,68,68,0.35)'; ctx.shadowBlur = 8; }
      else if (relations?.hasCompanion) { ctx.shadowColor = 'rgba(34,197,94,0.3)'; ctx.shadowBlur = 8; }
      else { ctx.shadowColor = 'rgba(245,158,11,0.4)'; ctx.shadowBlur = 8; }
      ctx.fillStyle = tileBg;
      ctx.fill(pw === cellSize && ph === cellSize ? tilePath : getCachedPath2D(pw - 2, ph - 2, 5));
      ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
      ctx.restore();
    }

    // Pass C: emoji / custom sprites — centred in the full area
    for (const { plantData, px, py, pw, ph, emojiSize, emojiOffsetY } of tileMetas) {
      const customBm = plantData!.sprite ? customSpriteCache.get(plantData!.sprite) : undefined;
      const twBm = !customBm ? twemojiCache.get(plantData!.emoji) : undefined;
      const cx = px + pw / 2, cy = py + ph / 2;
      if (customBm || twBm) {
        const s = Math.round(emojiSize);
        ctx.drawImage((customBm ?? twBm)!, cx - s / 2, cy + emojiOffsetY - s / 2, s, s);
      } else {
        const emojiImg = getCachedEmoji(plantData!.emoji, emojiSize);
        ctx.drawImage(emojiImg, cx - emojiImg.width / 2, cy + emojiOffsetY - emojiImg.height / 2);
      }
    }

    // Pass D: name labels — centred at bottom of area
    if (hasLabel) {
      ctx.font = '600 7px system-ui,sans-serif';
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      for (const { plantData, px, py, pw, ph } of tileMetas) {
        const name = plantData!.name.length > 6 ? plantData!.name.slice(0, 5) + '…' : plantData!.name;
        ctx.fillText(name, px + pw / 2, py + ph - 2);
      }
    }

    // Pass E: stage badges (font set once)
    ctx.font = '8px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    for (const { placed, px, py } of tileMetas) {
      const stageEmoji = placed.stage === 'seedling' ? '🌱' : placed.stage === 'established' ? '🌳' : '🌰';
      ctx.fillText(stageEmoji, px + 1, py + 1);
    }

    // Pass E.5: quantity badges — top-right corner of the full area
    if (cellSize >= 16) {
      ctx.font = `bold ${Math.max(7, Math.round(cellSize * 0.22))}px system-ui,sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const { placed, px, py, pw } of tileMetas) {
        const qty = placed.quantity ?? 1;
        if (qty <= 1) continue;
        const text = `×${qty}`;
        const tw = ctx.measureText(text).width;
        const bw = Math.round(tw + 5);
        const bh = Math.max(9, Math.round(cellSize * 0.28));
        const bx = px + pw - bw - 1;
        const by = py + 1;
        roundRect(ctx, bx, by, bw, bh, 3);
        ctx.fillStyle = primaryColor; ctx.fill();
        ctx.fillStyle = 'white';
        ctx.fillText(text, bx + bw / 2, by + bh / 2);
      }
    }

    // Pass F: bottom badges — centred at bottom of area
    if (cellSize >= 20) {
      for (const { plantData, px, py, pw, ph, relations, spacingIssues } of tileMetas) {
        let badgeText = '';
        let badgeBg = '';
        if (spacingIssues?.length && !relations?.hasEnemy) { badgeText = '↔ Too close'; badgeBg = 'hsl(38 92% 50%)'; }
        else if (relations?.hasEnemy && relations.enemyNames.length > 0) { badgeText = `❌ ${relations.enemyNames[0]}`; badgeBg = 'hsl(0 84% 60%)'; }
        else if (relations?.hasCompanion && !relations.hasEnemy && relations.companionNames.length > 0 && cellSize >= 24) { badgeText = `✅ ${relations.companionNames[0]}`; badgeBg = primaryColor; }
        if (!badgeText) continue;
        ctx.font = '600 6px system-ui,sans-serif';
        const bw = Math.min(ctx.measureText(badgeText).width + 4, pw - 2);
        const bh = 9;
        const bx = px + (pw - bw) / 2;
        const by = py + ph - bh - 2;
        roundRect(ctx, bx, by, bw, bh, 2);
        ctx.fillStyle = badgeBg; ctx.fill();
        ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, bx + bw / 2, by + bh / 2);
      }
    }

    // 8. Growth rings — centred in the full area
    for (const plant of plants) {
      const aw = plant.areaW ?? 1, ah = plant.areaH ?? 1;
      const ax = Math.floor(plant.x), ay = Math.floor(plant.y);
      if (ax + aw <= vpLeft || ax >= vpRight || ay + ah <= vpTop || ay >= vpBottom) continue;
      const plantData = getPlantById(plant.plantId);
      if (!plantData) continue;
      const pw = aw * cellSize, ph = ah * cellSize;
      const radius = Math.min(pw, ph) / 2 - 2.5;
      if (radius < 5) continue;
      const daysSincePlanted = plant.plantedAt ? Math.floor((Date.now() - new Date(plant.plantedAt).getTime()) / 86400000) : 0;
      const daysToHarvest = plantData.daysToHarvest ?? 90;
      const isEstablished = plant.stage === 'established';
      const growthPct = isEstablished ? 1 : plant.stage === 'seedling' ? 0.3 : Math.min(1, daysSincePlanted / daysToHarvest);
      const cx = ax * cellSize + pw / 2, cy = ay * cellSize + ph / 2;
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 2.5; ctx.stroke();
      if (growthPct > 0) {
        const ringColor = isEstablished ? 'rgba(34,197,94,0.85)' : growthPct >= 0.7 ? 'rgba(132,204,22,0.85)' : growthPct >= 0.4 ? 'rgba(163,230,53,0.8)' : 'rgba(134,239,172,0.75)';
        ctx.beginPath(); ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + growthPct * Math.PI * 2);
        ctx.strokeStyle = ringColor; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt';
      }
    }

    // 9. Companion / enemy arcs — spatial bucket lookup reduces O(n²) pair checks to O(n·k)
    //    where k is the average number of plants in neighbouring 6-cell buckets.
    //    Arc is drawn if either endpoint is in the viewport — culling only when both are off-screen. (#3)
    const BUCKET = 6;
    const drawn = new Set<string>();
    for (const plant of plants) {
      const pData = getPlantById(plant.plantId);
      if (!pData) continue;
      const bx = Math.floor(plant.x / BUCKET);
      const by = Math.floor(plant.y / BUCKET);
      for (let dbx = -1; dbx <= 1; dbx++) {
        for (let dby = -1; dby <= 1; dby++) {
          const neighbors = spatialBuckets.get(`${bx + dbx},${by + dby}`) ?? [];
          for (const other of neighbors) {
            if (plant.id === other.id) continue;
            const pairKey = [plant.id, other.id].sort().join('|');
            if (drawn.has(pairKey)) continue;
            const oData = getPlantById(other.plantId);
            if (!oData) continue;
            const isCompanion = pData.companions.includes(other.plantId) || oData.companions.includes(plant.plantId);
            const isEnemy = pData.enemies.includes(other.plantId) || oData.enemies.includes(plant.plantId);
            if (!isCompanion && !isEnemy) continue;
            const dist = Math.abs(plant.x - other.x) + Math.abs(plant.y - other.y);
            if (dist > 6) continue;
            // Cull arc only when both endpoints are outside the viewport
            if (!inViewport(Math.floor(plant.x), Math.floor(plant.y)) &&
                !inViewport(Math.floor(other.x), Math.floor(other.y))) continue;
            drawn.add(pairKey);
            const x1 = (plant.x + 0.5) * cellSize, y1 = (plant.y + 0.5) * cellSize;
            const x2 = (other.x + 0.5) * cellSize, y2 = (other.y + 0.5) * cellSize;
            const dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy) || 1;
            const arc = Math.min(len * 0.28, cellSize * 1.4);
            const cpX = (x1 + x2) / 2 + (-dy / len) * arc;
            const cpY = (y1 + y2) / 2 + (dx / len) * arc;
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cpX, cpY, x2, y2);
            ctx.strokeStyle = isEnemy ? 'rgba(239,68,68,0.55)' : 'rgba(34,197,94,0.6)';
            ctx.lineWidth = 1.5;
            if (isEnemy) ctx.setLineDash([3, 2]);
            ctx.stroke(); ctx.setLineDash([]);
          }
        }
      }
    }

      ctx.restore();
    };

    // Schedule at most one rAF per display frame. If one is already pending,
    // drawMainRef has been updated so the queued rAF will render the latest state.
    if (!mainRafPendingRef.current) {
      mainRafPendingRef.current = true;
      mainRafRef.current = scheduleFrame(() => {
        mainRafRef.current = null;
        mainRafPendingRef.current = false;
        drawMainRef.current?.();
      });
    }

    return () => {
      if (mainRafRef.current !== null) {
        cancelFrame(mainRafRef.current);
        mainRafRef.current = null;
        mainRafPendingRef.current = false;
      }
    };
  }, [gridW, gridH, cols, rows, cellSize, isDark, plants, shadeZones, showSunOverlay, showRotationOverlay, showColorCoding, settings.cellSizeCm, structures, themeColors, spriteVersion, layoutVersion, panOffset]);

  // ─── Overlay canvas: hover highlight, pending-plant ghost, resize preview ───
  useEffect(() => {
    drawOverlayRef.current = () => {
      const canvas = overlayCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = gridW * dpr, targetH = gridH * dpr;
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
        canvas.style.width = `${gridW}px`;
        canvas.style.height = `${gridH}px`;
      }
      resetCtx(ctx);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const { primaryColor } = themeColors;

      // A. Hover cell highlight — subtle fill on the cell under the cursor.
      //    Skip when moving a plant (confusing) or in structure mode.
      if (hoverCell && !pendingPlantId) {
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
        roundRect(ctx, hoverCell.x * cellSize + 1, hoverCell.y * cellSize + 1, cellSize - 2, cellSize - 2, 4);
        ctx.fill();
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // A2. Hover tile border — drawn on overlay so hoveredPlantId changes don't repaint main. (#1)
      if (hoverCell && !pendingPlantId) {
        const hovPx = hoverCell.x * cellSize, hovPy = hoverCell.y * cellSize;
        const hovPath = getCachedPath2D(cellSize - 2, cellSize - 2, 5);
        ctx.save();
        ctx.translate(hovPx + 1, hovPy + 1);
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1.5;
        ctx.stroke(hovPath);
        ctx.restore();
      }

      // A3. Selection tile border + spacing halo — on overlay to decouple from main repaint. (#1)
      if (internalSelectedId) {
        const sel = plants.find(p => p.id === internalSelectedId);
        if (sel) {
          const saw = sel.areaW ?? 1, sah = sel.areaH ?? 1;
          const spx = Math.floor(sel.x) * cellSize, spy = Math.floor(sel.y) * cellSize;
          const spw = saw * cellSize, sph = sah * cellSize;
          const selPath = getCachedPath2D(spw - 2, sph - 2, 5);
          ctx.save();
          ctx.translate(spx + 1, spy + 1);
          ctx.strokeStyle = primaryColor;
          ctx.lineWidth = 2;
          ctx.stroke(selPath);
          ctx.restore();
          // Spacing halo centred in the area
          const pData = getPlantById(sel.plantId);
          if (pData) {
            const spacingCells = Math.ceil(pData.spacingCm / settings.cellSizeCm);
            const haloCx = spx + spw / 2, haloCy = spy + sph / 2;
            const haloR = spacingCells * cellSize;
            ctx.beginPath(); ctx.arc(haloCx, haloCy, haloR, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(34,197,94,0.06)'; ctx.fill();
            ctx.strokeStyle = 'rgba(34,197,94,0.4)'; ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
          }
        }
      }

      // B. Pending plant ghost — show plant emoji + spacing halo at hover cell.
      if (pendingPlantId && !pendingIsStructure && hoverCell) {
        const ghostPlant = getPlantById(pendingPlantId);
        if (ghostPlant) {
          const gx = hoverCell.x * cellSize, gy = hoverCell.y * cellSize;
          const isOccupied = (hoverCell.x >= 0 && hoverCell.x < cols && hoverCell.y >= 0 && hoverCell.y < rows && occupiedCells[hoverCell.y * cols + hoverCell.x] !== 0);

          // Cell tint: red if occupied, green if clear
          ctx.fillStyle = isOccupied ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)';
          roundRect(ctx, gx + 1, gy + 1, cellSize - 2, cellSize - 2, 5);
          ctx.fill();

          // Dashed border
          ctx.strokeStyle = isOccupied ? 'rgba(239,68,68,0.6)' : 'rgba(34,197,94,0.6)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 3]);
          roundRect(ctx, gx + 1, gy + 1, cellSize - 2, cellSize - 2, 5);
          ctx.stroke();
          ctx.setLineDash([]);

          // Ghost emoji — custom sprite > Twemoji bitmap > system-font fallback
          const emojiSize = Math.max(cellSize * 0.88, 20);
          ctx.globalAlpha = 0.55;
          const ghostCustom = ghostPlant.sprite ? customSpriteCache.get(ghostPlant.sprite) : undefined;
          const ghostTw = !ghostCustom ? twemojiCache.get(ghostPlant.emoji) : undefined;
          if (ghostCustom || ghostTw) {
            const s = Math.round(emojiSize);
            ctx.drawImage((ghostCustom ?? ghostTw)!, gx + cellSize / 2 - s / 2, gy + cellSize / 2 - s / 2, s, s);
          } else {
            const emojiImg = getCachedEmoji(ghostPlant.emoji, emojiSize);
            ctx.drawImage(emojiImg, gx + cellSize / 2 - emojiImg.width / 2, gy + cellSize / 2 - emojiImg.height / 2);
          }
          ctx.globalAlpha = 1;

          // Spacing halo (dashed circle)
          const spacingCells = Math.ceil(ghostPlant.spacingCm / settings.cellSizeCm);
          const cx = (hoverCell.x + 0.5) * cellSize, cy = (hoverCell.y + 0.5) * cellSize;
          const r = spacingCells * cellSize;
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fillStyle = isOccupied ? 'rgba(239,68,68,0.04)' : 'rgba(34,197,94,0.05)';
          ctx.fill();
          ctx.strokeStyle = isOccupied ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
        }
      }

      // B2. Pending structure ghost
      if (pendingPlantId && pendingIsStructure && hoverCell) {
        const gx = hoverCell.x * cellSize, gy = hoverCell.y * cellSize;
        ctx.fillStyle = 'rgba(34,197,94,0.08)';
        roundRect(ctx, gx + 1, gy + 1, cellSize - 2, cellSize - 2, 4);
        ctx.fill();
        ctx.strokeStyle = 'rgba(34,197,94,0.5)';
        ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
        roundRect(ctx, gx + 1, gy + 1, cellSize - 2, cellSize - 2, 4);
        ctx.stroke(); ctx.setLineDash([]);
      }

      // C. Plant resize preview (existing logic)
      if (plantResize && (plantResize.currentW > 1 || plantResize.currentH > 1)) {
        const resizePlantData = getPlantById(plantResize.plantId);
        if (resizePlantData) {
          const rpx = plantResize.originX * cellSize;
          const rpy = plantResize.originY * cellSize;
          const rpw = plantResize.currentW * cellSize;
          const rph = plantResize.currentH * cellSize;

          ctx.fillStyle = 'rgba(34,197,94,0.1)';
          roundRect(ctx, rpx, rpy, rpw, rph, 4);
          ctx.fill();

          ctx.strokeStyle = primaryColor;
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          roundRect(ctx, rpx, rpy, rpw, rph, 4);
          ctx.stroke();
          ctx.setLineDash([]);

          const emojiSize = Math.max(cellSize * 0.4, 12);
          const resizeCustom = resizePlantData.sprite ? customSpriteCache.get(resizePlantData.sprite) : undefined;
          const resizeTw = !resizeCustom ? twemojiCache.get(resizePlantData.emoji) : undefined;
          const resizeS = Math.round(emojiSize);
          for (let dy = 0; dy < plantResize.currentH; dy++) {
            for (let dx = 0; dx < plantResize.currentW; dx++) {
              if (dx === 0 && dy === 0) continue;
              const rcx = plantResize.originX + dx, rcy = plantResize.originY + dy;
              const isOccupied = (rcx >= 0 && rcx < cols && rcy >= 0 && rcy < rows && occupiedCells[rcy * cols + rcx] !== 0);
              ctx.globalAlpha = isOccupied ? 0.3 : 0.6;
              const cx = (plantResize.originX + dx + 0.5) * cellSize;
              const cy = (plantResize.originY + dy + 0.5) * cellSize;
              if (resizeCustom || resizeTw) {
                ctx.drawImage((resizeCustom ?? resizeTw)!, cx - resizeS / 2, cy - resizeS / 2, resizeS, resizeS);
              } else {
                const eImg = getCachedEmoji(resizePlantData.emoji, emojiSize);
                ctx.drawImage(eImg, cx - eImg.width / 2, cy - eImg.height / 2);
              }
            }
          }
          ctx.globalAlpha = 1;
        }
      }
    };

    if (!overlayRafPendingRef.current) {
      overlayRafPendingRef.current = true;
      overlayRafRef.current = scheduleFrame(() => {
        overlayRafRef.current = null;
        overlayRafPendingRef.current = false;
        drawOverlayRef.current?.();
      });
    }

    return () => {
      if (overlayRafRef.current !== null) {
        cancelFrame(overlayRafRef.current);
        overlayRafRef.current = null;
        overlayRafPendingRef.current = false;
      }
    };
  }, [plantResize, occupiedCells, gridW, gridH, cols, rows, cellSize, themeColors, hoverCell, pendingPlantId, pendingIsStructure, settings.cellSizeCm, isDark, spriteVersion, layoutVersion, internalSelectedId, plants]);

  const dragPreview = useMemo(() => {
    if (!dragTooltip?.plantId) return null;

    const plantData = getPlantById(dragTooltip.plantId);
    if (!plantData) return null;

    const spacingCells = Math.max(1, Math.ceil(plantData.spacingCm / settings.cellSizeCm));
    const nearby = plants.filter(p => {
      const dx = p.x - dragTooltip.gridX;
      const dy = p.y - dragTooltip.gridY;
      return Math.sqrt(dx * dx + dy * dy) <= Math.max(spacingCells, 3);
    });

    const nearestSamePlant = nearby
      .filter(p => p.plantId === plantData.id)
      .map(p => ({
        distance: Math.sqrt(Math.pow(p.x - dragTooltip.gridX, 2) + Math.pow(p.y - dragTooltip.gridY, 2)),
      }))
      .sort((a, b) => a.distance - b.distance)[0];

    const companionPlant = nearby.find(p => {
      const other = getPlantById(p.plantId);
      return other && (plantData.companions.includes(other.id) || other.companions.includes(plantData.id));
    });

    const enemyPlant = nearby.find(p => {
      const other = getPlantById(p.plantId);
      return other && (plantData.enemies.includes(other.id) || other.enemies.includes(plantData.id));
    });

    const companionData = companionPlant ? getPlantById(companionPlant.plantId) : undefined;
    const enemyData = enemyPlant ? getPlantById(enemyPlant.plantId) : undefined;

    return {
      plantData,
      spacingCells,
      tooClose: Boolean(nearestSamePlant && nearestSamePlant.distance > 0 && nearestSamePlant.distance < spacingCells),
      actualSpacingCm: nearestSamePlant ? Math.round(nearestSamePlant.distance * settings.cellSizeCm) : null,
      companionData,
      companionReason: companionData ? getCompanionReason(plantData.id, companionData.id) : undefined,
      enemyData,
      enemyReason: enemyData ? getCompanionReason(plantData.id, enemyData.id) : undefined,
    };
  }, [dragTooltip, plants, settings.cellSizeCm]);

  // Track scroll position for ruler measurements
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollPos({ x: container.scrollLeft, y: container.scrollTop });
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Font pre-warming — renders a character with every canvas font variant into an off-screen
  // OffscreenCanvas on mount so the browser loads and caches font metrics before the first
  // real paint, eliminating first-frame text-layout stutter. (#5)
  useEffect(() => {
    const warm = new OffscreenCanvas(1, 1);
    const ctx = warm.getContext('2d');
    if (!ctx) return;
    for (const font of [
      '600 7px system-ui,sans-serif',
      '8px sans-serif',
      '600 6px system-ui,sans-serif',
    ]) {
      ctx.font = font;
      ctx.fillText('A', -99, -99); // off-screen — just triggers metric cache
    }
  }, []);

  // Detect container resize and devicePixelRatio changes; both require canvas repaint. (#6)
  useEffect(() => {
    // ResizeObserver: sidebar collapse, window resize, etc.
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      const ro = new ResizeObserver(() => setLayoutVersion(v => v + 1));
      ro.observe(containerRef.current);
      // Store disconnect for cleanup — use a closure ref trick
      (containerRef.current as any).__roDisconnect = () => ro.disconnect();
    }
    // DPR tracking: re-register media query each time DPR changes (e.g. moving monitors).
    let mq: MediaQueryList | null = null;
    const onChange = () => { setLayoutVersion(v => v + 1); register(); };
    const register = () => {
      mq?.removeEventListener('change', onChange);
      mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      mq.addEventListener('change', onChange);
    };
    register();
    return () => {
      mq?.removeEventListener('change', onChange);
      (containerRef.current as any)?.__roDisconnect?.();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Wire up canvas export fn. (#10)
  // scale=1 (default): fast path — toDataURL on the live display canvas.
  // scale>1 (e.g. 3):  high-res path — renders a fresh OffscreenCanvas at scale× DPR
  //                    and returns it as a PNG blob URL for print-quality PDF embedding.
  if (canvasExportRef) {
    canvasExportRef.current = async (scale = 1) => {
      const canvas = mainCanvasRef.current;
      if (!canvas) return null;
      if (scale <= 1) {
        return canvas.toDataURL('image/png', 1.0);
      }
      // High-res: render a fresh OffscreenCanvas at scale× so PDF export gets
      // ~300dpi equivalent without touching the live display canvas.
      const hiRes = new OffscreenCanvas(gridW * scale, gridH * scale);
      const hCtx = hiRes.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
      if (!hCtx) return canvas.toDataURL('image/png', 1.0);

      hCtx.setTransform(scale, 0, 0, scale, 0, 0);
      hCtx.save();
      roundRect(hCtx as unknown as CanvasRenderingContext2D, 0, 0, gridW, gridH, 8);
      hCtx.clip();

      const { bgColor } = themeColors;
      // Background
      hCtx.fillStyle = bgColor;
      hCtx.fillRect(0, 0, gridW, gridH);
      // Blit the GPU-cached static layer if available (already contains bg + grid lines).
      const staticKey = `${gridW},${gridH},${cols},${rows},${cellSize},${bgColor}`;
      if (staticBitmapRef.current && staticBitmapKeyRef.current === staticKey) {
        hCtx.drawImage(staticBitmapRef.current, 0, 0, gridW, gridH);
      } else if (staticCanvasRef.current) {
        hCtx.drawImage(staticCanvasRef.current, 0, 0, gridW, gridH);
      }

      // Plant tiles (Passes A–F, simplified for export — no shadows for speed)
      const hasLabel = cellSize >= 28;
      const sortedPlants = [...plants].sort((a, b) => {
        const aD = getPlantById(a.plantId), bD = getPlantById(b.plantId);
        return (aD?.category ?? '').localeCompare(bD?.category ?? '');
      });
      for (const placed of sortedPlants) {
        const plantData = getPlantById(placed.plantId);
        if (!plantData) continue;
        const aw = placed.areaW ?? 1, ah = placed.areaH ?? 1;
        const relations = companionMapRef.current.get(placed.id);
        const catColor = isDark ? categoryColorsDark[plantData.category] : categoryColors[plantData.category];
        const tileBg = isDark
          ? (relations?.hasEnemy ? 'hsl(0 30% 14%)' : relations?.hasCompanion ? 'hsl(142 25% 14%)' : catColor || 'hsl(25 20% 12%)')
          : (relations?.hasEnemy ? 'hsl(0 60% 95%)' : relations?.hasCompanion ? 'hsl(142 40% 93%)' : catColor || 'hsl(25 30% 94%)');
        const px = placed.x * cellSize, py = placed.y * cellSize;
        const pw = aw * cellSize, ph = ah * cellSize;
        hCtx.fillStyle = tileBg;
        roundRect(hCtx as unknown as CanvasRenderingContext2D, px + 1, py + 1, pw - 2, ph - 2, 5);
        hCtx.fill();
        // Emoji — centred in the full area
        const daysSincePlanted = placed.plantedAt ? Math.floor((Date.now() - new Date(placed.plantedAt).getTime()) / 86400000) : 0;
        const growthPct = placed.stage === 'established' ? 1 : placed.stage === 'seedling' ? 0.3 : Math.min(1, daysSincePlanted / (plantData.daysToHarvest ?? 90));
        const emojiSize = aw > 1 || ah > 1
          ? Math.max(Math.min(pw, ph) * 0.82, 20)
          : Math.max(cellSize * (0.88 + Math.min(0.1, growthPct * 0.1)), 20);
        const customBm = plantData.sprite ? customSpriteCache.get(plantData.sprite) : undefined;
        const twBm = !customBm ? twemojiCache.get(plantData.emoji) : undefined;
        const ecx = px + pw / 2, ecy = py + ph / 2;
        if (customBm || twBm) {
          const s = Math.round(emojiSize);
          hCtx.drawImage((customBm ?? twBm)!, ecx - s / 2, ecy - s / 2, s, s);
        } else {
          const emojiImg = getCachedEmoji(plantData.emoji, emojiSize);
          hCtx.drawImage(emojiImg, ecx - emojiImg.width / 2, ecy - emojiImg.height / 2);
        }
        if (hasLabel) {
          hCtx.font = '600 7px system-ui,sans-serif';
          hCtx.fillStyle = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
          hCtx.textAlign = 'center'; hCtx.textBaseline = 'alphabetic';
          const name = plantData.name.length > 6 ? plantData.name.slice(0, 5) + '…' : plantData.name;
          hCtx.fillText(name, px + pw / 2, py + ph - 2);
        }
      }

      hCtx.restore();
      const blob = await hiRes.convertToBlob({ type: 'image/png', quality: 1.0 });
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    };
  }

  // Canvas-based plant interaction handlers
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (panMode) return;
    const { x, y } = snapToGridFn(e.clientX, e.clientY);
    if (pendingPlantId && !pendingIsStructure) {
      markDirty(x, y);
      onPlacePlant(pendingPlantId, x, y);
      onCancelPending?.();
      return;
    }
    if (pendingPlantId && pendingIsStructure) {
      onPlaceStructure(pendingPlantId, Math.round(x), Math.round(y));
      onCancelPending?.();
      return;
    }
    setEditingStructure(null);
    if (!propStructureMode) {
      const cellX = Math.floor(x), cellY = Math.floor(y);
      const plant = plantCellIndex.get(`${cellX},${cellY}`);
      if (plant) {
        // Toggle local selection — resize handles appear, but NO info panel popup
        setInternalSelectedId(prev => prev === plant.id ? null : plant.id);
      } else {
        // Clicking empty space: clear selection and close any open info panel
        setInternalSelectedId(null);
        onSelectPlant(null);
      }
    } else {
      setInternalSelectedId(null);
      onSelectPlant(null);
    }
  }, [panMode, snapToGridFn, pendingPlantId, pendingIsStructure, plantCellIndex, propStructureMode, markDirty, onPlacePlant, onPlaceStructure, onCancelPending, onSelectPlant]);

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 1 || panMode || propStructureMode) return;
    const { x, y } = snapToGridFn(e.clientX, e.clientY);
    const cellX = Math.floor(x), cellY = Math.floor(y);
    const plant = plantCellIndex.get(`${cellX},${cellY}`);
    if (plant) handlePlantMoveStart(e, plant.id, plant.x, plant.y);
  }, [panMode, propStructureMode, snapToGridFn, plantCellIndex, handlePlantMoveStart]);

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    // Use the last coalesced event — on 120 Hz / stylus devices the browser may
    // fire many mid-frame events; only the final position matters for hover state.
    const coalesced = e.nativeEvent.getCoalescedEvents?.();
    const finalEvent = coalesced?.length ? coalesced[coalesced.length - 1] : e.nativeEvent;
    const { x, y } = snapToGridFn(finalEvent.clientX, finalEvent.clientY);
    const cellX = Math.floor(x), cellY = Math.floor(y);
    setHoverCell({ x: cellX, y: cellY });
    if (movingPlant || propStructureMode) { setHoveredPlantId(null); return; }
    const plant = plantCellIndex.get(`${cellX},${cellY}`);
    setHoveredPlantId(plant?.id ?? null);
  }, [movingPlant, propStructureMode, snapToGridFn, plantCellIndex]);

  const handleCanvasContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (propStructureMode) return;
    const { x, y } = snapToGridFn(e.clientX, e.clientY);
    const cellX = Math.floor(x), cellY = Math.floor(y);
    const plant = plantCellIndex.get(`${cellX},${cellY}`);
    if (plant) onRemovePlant(plant.id);
  }, [propStructureMode, snapToGridFn, plantCellIndex, onRemovePlant]);

  return (
    <div className="w-full h-full relative">
      {/* Left Ruler — pan handled by CSS translateY on the inner wrapper, so only one
          element is transformed on pan instead of re-positioning every label div. */}
      {!isMobile && (
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '60px',
          backgroundColor: '#f0f0f0',
          borderRight: '1px solid #ddd',
          zIndex: 40,
          height: '100%',
          overflow: 'hidden'
        }}>
          <div style={{ transform: `translateY(${panOffset.y}px)`, position: 'relative' }}>
            {Array.from({ length: rows }).map((_, i) => {
              if (i % labelInterval !== 0) return null;
              const distance = i * settings.cellSizeCm;
              const label = settings.unit === 'meters'
                ? `${Math.round(distance / 100)}m`
                : `${Math.round(distance / 30.48)}ft`;
              return (
                <div
                  key={`row-${i}`}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: i * cellSize,
                    width: '60px',
                    height: cellSize,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    paddingRight: '4px',
                    fontSize: '10px',
                    fontWeight: '600',
                  }}
                >
                  {label}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Ruler — pan handled by CSS translateX on the inner wrapper. */}
      {!isMobile && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 60,
          right: 0,
          height: '20px',
          backgroundColor: '#f0f0f0',
          borderBottom: '1px solid #ddd',
          zIndex: 40,
          overflow: 'hidden'
        }}>
          <div style={{ transform: `translateX(${panOffset.x}px)`, position: 'relative', height: '100%' }}>
            {Array.from({ length: cols }).map((_, i) => {
              if (i % labelInterval !== 0) return null;
              const distance = i * settings.cellSizeCm;
              const label = settings.unit === 'meters'
                ? `${Math.round(distance / 100)}m`
                : `${Math.round(distance / 30.48)}ft`;
              return (
                <span
                  key={`col-${i}`}
                  style={{
                    position: 'absolute',
                    left: i * cellSize,
                    width: cellSize,
                    textAlign: 'center',
                    fontSize: '10px',
                    fontWeight: '600',
                    top: '2px',
                  }}
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Canvas Container with margin to account for rulers */}
      <div
        style={{
          position: 'absolute',
          top: isMobile ? 0 : 20,
          left: isMobile ? 0 : 60,
          right: 0,
          bottom: 0,
          overflow: 'hidden'
        }}
        ref={containerRef}
        onWheel={handleWheel}
        onPointerDown={handlePanStart}
        onTouchStart={e => {
          if (e.touches.length === 2) {
            const t0 = e.touches[0], t1 = e.touches[1];
            touchPanRef.current = {
              id: 0,
              x: (t0.clientX + t1.clientX) / 2,
              y: (t0.clientY + t1.clientY) / 2,
              dist: Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY),
            };
          }
        }}
        onTouchMove={e => {
          if (e.touches.length === 2 && touchPanRef.current) {
            const t0 = e.touches[0], t1 = e.touches[1];
            const midX = (t0.clientX + t1.clientX) / 2;
            const midY = (t0.clientY + t1.clientY) / 2;
            const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);

            // Two-finger pan
            const dx = midX - touchPanRef.current.x;
            const dy = midY - touchPanRef.current.y;
            setPanOffset(prev => clampPan({ x: prev.x + dx, y: prev.y + dy }));

            // Pinch zoom anchored at the midpoint between fingers
            const prevDist = touchPanRef.current.dist ?? dist;
            if (Math.abs(dist - prevDist) > 2 && onSettingsChange) {
              const ratio = dist / prevDist;
              const newSize = Math.max(16, Math.min(64, Math.round(cellSize * ratio)));
              if (newSize !== cellSize) {
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect) {
                  const mx = midX - rect.left;
                  const my = midY - rect.top;
                  const newGridW = cols * newSize;
                  const newGridH = rows * newSize;
                  const cw = containerRef.current!.clientWidth;
                  const ch = containerRef.current!.clientHeight;
                  setPanOffset(prev => ({
                    x: Math.min(0, Math.max(-(newGridW - cw), prev.x - mx * (ratio - 1))),
                    y: Math.min(0, Math.max(-(newGridH - ch), prev.y - my * (ratio - 1))),
                  }));
                }
                onSettingsChange({ ...settings, cellSizePx: newSize });
              }
            }

            touchPanRef.current = { id: 0, x: midX, y: midY, dist };
          }
        }}
        onTouchEnd={() => { touchPanRef.current = null; }}
      >
        <div
          style={{
            width: gridW,
            height: gridH,
            transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
            transformOrigin: 'top left',
            position: 'relative',
            touchAction: 'none',
            cursor: pendingPlantId
              ? 'crosshair'
              : hoveredPlantId && !propStructureMode
                ? (movingPlant ? 'grabbing' : 'pointer')
                : panMode ? 'grab' : 'default',
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={() => { setDragOver(false); setDragTooltip(null); }}
          onClick={handleCanvasClick}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onContextMenu={handleCanvasContextMenu}
          onMouseLeave={() => { setHoveredPlantId(null); setHoverCell(null); setInfoTooltipId(null); }}
        >
          {/* Main canvas: grid, shade/rotation, plant tiles, growth rings, companion arcs, spacing halo */}
          <canvas
            ref={mainCanvasRef}
            className={`absolute rounded-lg border-2 transition-colors pointer-events-none ${dragOver ? 'border-primary' : 'border-border'}`}
            style={{ left: 0, top: 0, zIndex: 0, willChange: 'transform' }}
          />

          {/* Overlay canvas: plant-resize preview (separate to avoid repainting plants on every drag move) */}
          <canvas
            ref={overlayCanvasRef}
            className="absolute pointer-events-none"
            style={{ left: 0, top: 0, zIndex: 5, willChange: 'transform' }}
          />

          {/* Drag preview circle for spacing while dragging from sidebar */}
          {dragOver && dragTooltip && dragPreview && (
            <div
              className="absolute pointer-events-none rounded-full border-2 border-dashed z-[1]"
              style={{
                left: (dragTooltip.gridX - dragPreview.spacingCells + 0.5) * cellSize,
                top: (dragTooltip.gridY - dragPreview.spacingCells + 0.5) * cellSize,
                width: dragPreview.spacingCells * 2 * cellSize,
                height: dragPreview.spacingCells * 2 * cellSize,
                borderColor: dragPreview.tooClose ? 'hsl(var(--destructive) / 0.45)' : 'hsl(var(--primary) / 0.45)',
                backgroundColor: dragPreview.tooClose ? 'hsl(var(--destructive) / 0.08)' : 'hsl(var(--primary) / 0.06)',
              }}
            />
          )}

          {/* Resize preview size label (the visual preview is drawn on the overlay canvas) */}
          {plantResize && (plantResize.currentW > 1 || plantResize.currentH > 1) && (
            <div
              className="absolute pointer-events-none z-20"
              style={{
                left: plantResize.originX * cellSize,
                top: plantResize.originY * cellSize,
              }}
            >
              <span className="absolute -top-5 left-0 text-[10px] font-medium text-primary bg-card px-1 rounded">
                {plantResize.currentW}×{plantResize.currentH}
              </span>
            </div>
          )}

          {/* Placed structures — cell fills are now drawn on the main canvas */}
          {structures.map(struct => {
            const data = getStructureById(struct.structureId);
            if (!data) return null;
            const structureMode = propStructureMode ?? internalStructureMode;
            const isDisabled = !structureMode;

            return (
              <div key={struct.id}>
                <div
                  data-structure-tile
                className={`absolute border-4 flex flex-col items-center justify-center group cursor-move ${data.shape === 'circle' ? 'rounded-full' : 'rounded-md'} ${isDisabled ? 'pointer-events-none opacity-60' : ''}`}
                style={{
                  left: struct.x * cellSize,
                  top: struct.y * cellSize,
                  width: struct.widthCells * cellSize,
                  height: struct.heightCells * cellSize,
                  backgroundColor: data.color,
                  borderColor: 'hsl(var(--primary))',
                  zIndex: moving?.id === struct.id ? 10 : 1,
                }}
                title={`${data.name} — drag to move`}
                onPointerDown={e => handleMoveStart(e, struct.id, struct.x, struct.y)}
              >
                <span className="text-lg">{data.emoji}</span>
                <span className="text-[10px] font-medium text-foreground/80">{data.name}</span>
                {data.canGrowInside && !data.isContainer && (
                  <span className="text-[8px] text-primary font-medium">🌱 Grow inside</span>
                )}
                {data.isContainer && (
                  <span className="text-[8px] text-muted-foreground">{struct.widthCells}×{struct.heightCells}</span>
                )}
                <button
                  onClick={e => { e.stopPropagation(); onRemoveStructure(struct.id); setEditingStructure(null); }}
                  className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove structure"
                  data-no-plant-move="true"
                >
                  <X className="h-3 w-3" />
                </button>
                {/* Edit size button for containers */}
                {data.isContainer && (
                  <button
                    onClick={e => { e.stopPropagation(); setEditingStructure(editingStructure === struct.id ? null : struct.id); }}
                    className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
                    title="Edit size"
                    data-no-plant-move="true"
                  >
                    ✎
                  </button>
                )}
                {/* Standalone auto-fill button */}
                {data.canGrowInside && onSmartAutoFill && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onSmartAutoFill(struct.x, struct.y, struct.widthCells, struct.heightCells, !!data.isContainer);
                    }}
                    className="absolute -bottom-2 -right-2 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    title="Smart auto-fill with favourites"
                    data-no-plant-move="true"
                  >
                    <Wand2 className="h-3 w-3" />
                  </button>
                )}
                {/* Size editor + plant suggestions popover */}
                {editingStructure === struct.id && (
                  <div
                    className="absolute -bottom-2 left-0 translate-y-full z-50 bg-card border border-border rounded-lg shadow-lg p-2.5 min-w-[220px]"
                    onClick={e => e.stopPropagation()}
                    onMouseDown={e => e.stopPropagation()}
                  >
                    <button
                      onClick={e => { e.stopPropagation(); setEditingStructure(null); }}
                      className="absolute top-1.5 right-1.5 h-5 w-5 rounded flex items-center justify-center hover:bg-muted text-muted-foreground"
                      title="Close"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    {data.isContainer && (
                      <div className="flex items-center gap-2 mb-2">
                        <label className="text-[10px] text-muted-foreground">W</label>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          value={struct.widthCells}
                          onChange={e => onResizeStructure(struct.id, Math.max(1, Number(e.target.value)), struct.heightCells)}
                          className="w-12 h-6 text-xs text-center"
                        />
                        <label className="text-[10px] text-muted-foreground">H</label>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          value={struct.heightCells}
                          onChange={e => onResizeStructure(struct.id, struct.widthCells, Math.max(1, Number(e.target.value)))}
                          className="w-12 h-6 text-xs text-center"
                        />
                      </div>
                    )}
                    {data.canGrowInside && (
                      <div>
                        <p className="text-[10px] font-semibold text-foreground flex items-center gap-1 mb-1">
                          <Lightbulb className="h-3 w-3 text-primary" /> Suggested plants
                          {favouriteIds.length > 0 && <span className="text-[8px] text-amber-500 ml-1">★ favourites first</span>}
                        </p>
                        <p className="text-[9px] text-muted-foreground mb-1.5">
                          {struct.widthCells}×{struct.heightCells} cells ({struct.widthCells * settings.cellSizeCm}×{struct.heightCells * settings.cellSizeCm}cm)
                        </p>
                        <div className="space-y-0.5 max-h-[120px] overflow-y-auto">
                          {suggestPlantsForBed(struct.widthCells, struct.heightCells, settings.cellSizeCm, data.isContainer, favouriteIds).map(s => (
                            <div
                              key={s.plant.id}
                              className={`flex items-center gap-1.5 text-[10px] px-1.5 py-1 rounded hover:bg-muted cursor-grab ${favouriteIds.includes(s.plant.id) ? 'bg-amber-500/5' : ''}`}
                              draggable
                              onDragStart={e => {
                                e.dataTransfer.setData('plantId', s.plant.id);
                                setEditingStructure(null);
                              }}
                            >
                              {favouriteIds.includes(s.plant.id) && <span className="text-amber-500 text-[8px]">★</span>}
                              <span>{s.plant.emoji}</span>
                              <span className="font-medium text-foreground">{s.plant.name}</span>
                              <span className="text-muted-foreground ml-auto">{s.reason}</span>
                            </div>
                          ))}
                        </div>
                        {/* Auto-fill button */}
                        {onSmartAutoFill && favouriteIds.length > 0 && (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              onSmartAutoFill(struct.x, struct.y, struct.widthCells, struct.heightCells, !!data.isContainer);
                              setEditingStructure(null);
                            }}
                            className="mt-2 w-full flex items-center justify-center gap-1.5 text-[10px] font-semibold px-2 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          >
                            <Wand2 className="h-3 w-3" /> Smart auto-fill
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {/* Show suggestions button for growable non-container structures */}
                {data.canGrowInside && !data.isContainer && (
                  <button
                    onClick={e => { e.stopPropagation(); setEditingStructure(editingStructure === struct.id ? null : struct.id); }}
                    className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
                    title="Plant suggestions"
                    data-no-plant-move="true"
                  >
                    💡
                  </button>
                )}
                <div
                  className="absolute top-0 -right-1 w-2 h-full cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'hsl(var(--primary) / 0.4)' }}
                  onPointerDown={e => handleResizeStart(e, struct.id, struct.widthCells, struct.heightCells, 'right')}
                />
                <div
                  className="absolute -bottom-1 left-0 w-full h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'hsl(var(--primary) / 0.4)' }}
                  onPointerDown={e => handleResizeStart(e, struct.id, struct.widthCells, struct.heightCells, 'bottom')}
                />
                <div
                  className="absolute -bottom-1 -right-1 w-3 h-3 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity rounded-sm"
                  style={{ background: 'hsl(var(--primary) / 0.6)' }}
                  onPointerDown={e => handleResizeStart(e, struct.id, struct.widthCells, struct.heightCells, 'corner')}
                />
              </div>
              </div>
            );
          })}

          {/* Selected plant floating resize handles (only for the selected plant) */}
          {internalSelectedId && !propStructureMode && (() => {
            const sel = plants.find(p => p.id === internalSelectedId);
            if (!sel) return null;
            const saw = sel.areaW ?? 1, sah = sel.areaH ?? 1;
            const spw = saw * cellSize, sph = sah * cellSize;
            return (
              <>
                <div
                  className="absolute cursor-ew-resize rounded-r"
                  style={{ left: sel.x * cellSize + spw - 6, top: sel.y * cellSize + 1, width: 12, height: sph - 2, background: 'hsl(var(--primary) / 0.6)', zIndex: 12 }}
                  onPointerDown={e => { e.stopPropagation(); handlePlantResizeStart(e, sel, 'right'); }}
                  title="Drag to fill row →"
                />
                <div
                  className="absolute cursor-ns-resize rounded-b"
                  style={{ left: sel.x * cellSize + 1, top: sel.y * cellSize + sph - 6, width: spw - 2, height: 12, background: 'hsl(var(--primary) / 0.6)', zIndex: 12 }}
                  onPointerDown={e => { e.stopPropagation(); handlePlantResizeStart(e, sel, 'bottom'); }}
                  title="Drag to fill column ↓"
                />
                <div
                  className="absolute cursor-nwse-resize rounded-sm"
                  style={{ left: sel.x * cellSize + spw - 5, top: sel.y * cellSize + sph - 5, width: 10, height: 10, background: 'hsl(var(--primary) / 0.75)', zIndex: 12 }}
                  onPointerDown={e => { e.stopPropagation(); handlePlantResizeStart(e, sel, 'corner'); }}
                  title="Drag to fill area"
                />
                <button
                  className="absolute rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm"
                  style={{ left: sel.x * cellSize - 5, top: sel.y * cellSize - 5, width: 16, height: 16, zIndex: 12 }}
                  onClick={e => { e.stopPropagation(); onRemovePlant(sel.id); }}
                  title="Remove plant"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </>
            );
          })()}

          {/* Drag tooltip showing spacing info */}
          {dragOver && dragTooltip && (
            <div
              className="absolute pointer-events-none z-30 bg-card/95 backdrop-blur-sm text-foreground text-[10px] px-2 py-1 rounded-lg border border-border shadow-md max-w-[200px]"
              style={{
                left: dragTooltip.gridX * cellSize + cellSize + 4,
                top: dragTooltip.gridY * cellSize,
              }}
            >
              {dragPreview ? (
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">
                    {dragPreview.plantData.emoji} {dragPreview.plantData.name} needs {dragPreview.plantData.spacingCm}cm spacing
                  </p>
                  <p className={dragPreview.tooClose ? 'text-destructive' : 'text-primary'}>
                    {dragPreview.tooClose
                      ? `Too close here (${dragPreview.actualSpacingCm}cm)`
                      : 'Spacing looks good here'}
                  </p>
                  {dragPreview.companionData && (
                    <p className="text-primary">
                      ✅ Near {dragPreview.companionData.name}: {dragPreview.companionReason || 'helpful companion'}
                    </p>
                  )}
                  {dragPreview.enemyData && (
                    <p className="text-destructive">
                      ❌ Avoid {dragPreview.enemyData.name}: {dragPreview.enemyReason || 'poor neighbour'}
                    </p>
                  )}
                </div>
              ) : <span className="text-muted-foreground">Drop item here</span>}
            </div>
          )}

          {/* ℹ button — appears on hover, only for non-selected plants. Click to select (opens info panel).
              Hovering the button itself shows a compact tooltip so the main plant area stays drag-friendly. */}
          {hoveredPlantId && hoveredPlantId !== internalSelectedId && !movingPlant && !propStructureMode && hoverCell && (() => {
            const plant = plants.find(p => p.id === hoveredPlantId);
            if (!plant) return null;
            return (
              <button
                className="absolute z-20 flex items-center justify-center rounded-full bg-primary/80 text-primary-foreground hover:bg-primary transition-colors shadow-sm select-none"
                style={{ width: 14, height: 14, fontSize: 9, fontWeight: 700, fontStyle: 'italic',
                  left: (hoverCell.x + 1) * cellSize - 15, top: hoverCell.y * cellSize + 2 }}
                onPointerDown={e => e.stopPropagation()}
                onMouseEnter={() => setInfoTooltipId(plant.id)}
                onMouseLeave={() => setInfoTooltipId(null)}
                onClick={e => { e.stopPropagation(); setInternalSelectedId(plant.id); onSelectPlant(plant); }}
                title="Plant info"
              >
                i
              </button>
            );
          })()}

          {/* Tooltip — only appears when the ℹ button above is hovered */}
          {infoTooltipId && (() => {
            const plant = plants.find(p => p.id === infoTooltipId);
            const plantData = plant && getPlantById(plant.plantId);
            if (!plant || !plantData) return null;
            const relations = companionMap.get(plant.id);
            const spacingIssues = spacingConflicts.get(plant.id);
            const daysSincePlanted = plant.plantedAt ? Math.floor((Date.now() - new Date(plant.plantedAt).getTime()) / 86400000) : 0;
            const lines: string[] = [`${plantData.name} (${plant.stage}, ${daysSincePlanted}d)`];
            if (spacingIssues) lines.push(`⚠️ ${spacingIssues[0]}`);
            if (relations?.hasCompanion && relations.companionNames.length > 0) lines.push(`✅ Good with: ${relations.companionNames.join(', ')}`);
            if (relations?.hasEnemy && relations.enemyNames.length > 0) lines.push(`❌ Bad with: ${relations.enemyNames.join(', ')}`);
            if (relations?.reasons?.[0]) lines.push(`💡 ${relations.reasons[0]}`);
            lines.push('Click ℹ to open full info · Drag handles to fill');
            const hc = hoverCell ?? { x: Math.floor(plant.x), y: Math.floor(plant.y) };
            const tipLeft = Math.min((hc.x + 1.2) * cellSize, gridW - 210);
            const tipTop = Math.max(0, hc.y * cellSize - 4);
            return (
              <div
                className="absolute pointer-events-none z-50 bg-card/95 backdrop-blur-sm text-foreground text-[10px] px-2 py-1.5 rounded-lg border border-border shadow-md max-w-[200px]"
                style={{ left: tipLeft, top: tipTop }}
              >
                {lines.map((line, i) => <p key={i} className={i === 0 ? 'font-semibold' : 'text-muted-foreground mt-0.5'}>{line}</p>)}
              </div>
            );
          })()}

          {/* Empty state */}
          {plants.length === 0 && structures.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center bg-card/80 backdrop-blur-sm px-6 py-4 rounded-xl shadow-sm">
                <span className="text-3xl block mb-2">🌱</span>
                <p className="text-muted-foreground text-sm font-medium">
                  Drag plants from the sidebar to start!
                </p>
                <p className="text-muted-foreground text-xs mt-1 hidden sm:block">
                  Drag edges to fill rows · Right-click to remove · Ctrl+Scroll to zoom
                </p>
                <p className="text-muted-foreground text-xs mt-1 sm:hidden">
                  Tap a plant in the sidebar, then tap here to place it
                </p>
              </div>
            </div>
          )}

          {/* Tap-to-place cursor hint */}
          {pendingPlantId && !pendingIsStructure && (() => {
            const plantData = getPlantById(pendingPlantId);
            if (!plantData) return null;
            return (
              <div className="absolute inset-0 pointer-events-none z-40 flex items-center justify-center sm:hidden">
                <div className="bg-primary/90 text-primary-foreground text-xs px-3 py-2 rounded-full shadow-lg animate-bounce">
                  {plantData.emoji} Tap grid to place {plantData.name}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
      {/* Minimap + canvas layer controls — portalled into the sidebar when controlsPortalRef is set,
          otherwise rendered as absolute overlays on the canvas (legacy / mobile fallback). */}
      {!isMobile && (() => {
        const canvasLayersPanel = (
          <div className="space-y-2">
            {/* Overview / minimap */}
            <GardenMinimap
              plants={plants}
              structures={structures}
              shadeZones={shadeZones}
              settings={settings}
              cols={cols}
              rows={rows}
              panOffset={panOffset}
              containerRef={containerRef}
              showSunOverlay={showSunOverlay}
              onNavigate={(pan) => setPanOffset(clampPan(pan))}
              sidebarMode={!!controlsPortalRef}
            />

            {/* Canvas legend + rotation heatmap toggle */}
            {plants.length > 0 && (
              <div className="rounded border border-border/60 bg-card/90 select-none">
                <div
                  className="border-b border-border/40 text-center"
                  style={{ fontSize: 8, padding: '2px 6px', color: 'hsl(var(--muted-foreground))' }}
                >
                  canvas layers
                </div>
                <div className="p-2 space-y-1.5">
                  {/* Companion arc legend */}
                  <div className="flex items-center gap-1.5">
                    <svg width="22" height="10" className="shrink-0">
                      <path d="M2 8 Q11 2 20 8" stroke="rgba(34,197,94,0.7)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                    </svg>
                    <span style={{ fontSize: 9, color: 'hsl(var(--muted-foreground))' }}>Companion</span>
                  </div>
                  {/* Enemy arc legend */}
                  <div className="flex items-center gap-1.5">
                    <svg width="22" height="10" className="shrink-0">
                      <path d="M2 5 Q11 5 20 5" stroke="rgba(239,68,68,0.7)" strokeWidth="1.5" fill="none" strokeDasharray="3,2"/>
                    </svg>
                    <span style={{ fontSize: 9, color: 'hsl(var(--muted-foreground))' }}>Enemy</span>
                  </div>
                  {/* Growth ring legend */}
                  <div className="flex items-center gap-1.5">
                    <svg width="16" height="16" className="shrink-0">
                      <circle cx="8" cy="8" r="6" stroke="rgba(0,0,0,0.1)" strokeWidth="2.5" fill="none"/>
                      <path d="M8 2 A6 6 0 0 1 14 8" stroke="rgba(34,197,94,0.85)" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                    </svg>
                    <span style={{ fontSize: 9, color: 'hsl(var(--muted-foreground))' }}>Growth</span>
                  </div>
                  {/* Rotation toggle */}
                  <div className="pt-1 border-t border-border/40">
                    <button
                      onClick={() => setShowRotationOverlay(v => !v)}
                      className={`text-[9px] font-semibold px-2 py-1 rounded w-full transition-colors ${
                        showRotationOverlay ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      🔄 {showRotationOverlay ? 'Hide rotation' : 'Show rotation'}
                    </button>
                  </div>
                  {/* Rotation colour key */}
                  {showRotationOverlay && (
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 pt-0.5">
                      {([
                        ['legumes', 'rgba(134,239,172,0.8)', 'Legumes'],
                        ['brassicas', 'rgba(196,181,253,0.8)', 'Brassicas'],
                        ['roots', 'rgba(253,186,116,0.8)', 'Roots'],
                        ['alliums', 'rgba(253,224,71,0.8)', 'Alliums'],
                        ['solanaceae', 'rgba(252,165,165,0.8)', 'Solanaceae'],
                        ['cucurbits', 'rgba(103,232,249,0.8)', 'Cucurbits'],
                        ['leafy', 'rgba(167,243,208,0.8)', 'Leafy'],
                        ['other', 'rgba(203,213,225,0.8)', 'Other'],
                      ] as const).map(([, color, label]) => (
                        <div key={label} className="flex items-center gap-1">
                          <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color, flexShrink: 0 }} />
                          <span style={{ fontSize: 8, color: 'hsl(var(--muted-foreground))' }} className="truncate">{label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* PNG export */}
                  <div className="pt-1 border-t border-border/40">
                    <button
                      onClick={() => {
                        const canvas = mainCanvasRef.current;
                        if (!canvas) return;
                        canvas.toBlob(blob => {
                          if (!blob) return;
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = 'garden-plan.png';
                          a.click();
                          URL.revokeObjectURL(url);
                        }, 'image/png');
                      }}
                      className="text-[9px] font-semibold px-2 py-1 rounded w-full transition-colors text-muted-foreground hover:bg-muted flex items-center justify-center gap-1"
                      title="Download garden as PNG"
                    >
                      <Download className="h-2.5 w-2.5" /> Save PNG
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

        if (controlsPortalRef) {
          // Portal ref provided — wait for the target to mount, then portal in.
          // Return null on the first render (before forceUpdate fires) to avoid a brief legacy flash.
          if (!controlsPortalRef.current) return null;
          return createPortal(canvasLayersPanel, controlsPortalRef.current);
        }

        // No portal ref provided — render as absolute overlays directly on the canvas
        return (
          <div
            className="absolute pointer-events-none"
            style={{ bottom: 10, left: 70, right: 10, zIndex: 35, display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}
          >
            {plants.length > 0 && (
              <div className="pointer-events-auto rounded border border-border/60 shadow-lg bg-card/90 backdrop-blur-sm select-none" style={{ minWidth: 130 }}>
                <div className="border-b border-border/40 text-center" style={{ fontSize: 8, padding: '2px 6px', color: 'hsl(var(--muted-foreground))' }}>
                  canvas layers
                </div>
                <div className="p-2 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <svg width="22" height="10" className="shrink-0"><path d="M2 8 Q11 2 20 8" stroke="rgba(34,197,94,0.7)" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
                    <span style={{ fontSize: 9, color: 'hsl(var(--muted-foreground))' }}>Companion</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg width="22" height="10" className="shrink-0"><path d="M2 5 Q11 5 20 5" stroke="rgba(239,68,68,0.7)" strokeWidth="1.5" fill="none" strokeDasharray="3,2"/></svg>
                    <span style={{ fontSize: 9, color: 'hsl(var(--muted-foreground))' }}>Enemy</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg width="16" height="16" className="shrink-0">
                      <circle cx="8" cy="8" r="6" stroke="rgba(0,0,0,0.1)" strokeWidth="2.5" fill="none"/>
                      <path d="M8 2 A6 6 0 0 1 14 8" stroke="rgba(34,197,94,0.85)" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                    </svg>
                    <span style={{ fontSize: 9, color: 'hsl(var(--muted-foreground))' }}>Growth</span>
                  </div>
                  <div className="pt-1 border-t border-border/40">
                    <button onClick={() => setShowRotationOverlay(v => !v)} className={`text-[9px] font-semibold px-2 py-1 rounded w-full transition-colors ${showRotationOverlay ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted'}`}>
                      🔄 {showRotationOverlay ? 'Hide rotation' : 'Show rotation'}
                    </button>
                  </div>
                  {showRotationOverlay && (
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 pt-0.5">
                      {([['legumes','rgba(134,239,172,0.8)','Legumes'],['brassicas','rgba(196,181,253,0.8)','Brassicas'],['roots','rgba(253,186,116,0.8)','Roots'],['alliums','rgba(253,224,71,0.8)','Alliums'],['solanaceae','rgba(252,165,165,0.8)','Solanaceae'],['cucurbits','rgba(103,232,249,0.8)','Cucurbits'],['leafy','rgba(167,243,208,0.8)','Leafy'],['other','rgba(203,213,225,0.8)','Other']] as const).map(([,color,label]) => (
                        <div key={label} className="flex items-center gap-1">
                          <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color, flexShrink: 0 }} />
                          <span style={{ fontSize: 8, color: 'hsl(var(--muted-foreground))' }} className="truncate">{label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="pt-1 border-t border-border/40">
                    <button onClick={() => { const canvas = mainCanvasRef.current; if (!canvas) return; canvas.toBlob(blob => { if (!blob) return; const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'garden-plan.png'; a.click(); URL.revokeObjectURL(url); }, 'image/png'); }} className="text-[9px] font-semibold px-2 py-1 rounded w-full transition-colors text-muted-foreground hover:bg-muted flex items-center justify-center gap-1" title="Download garden as PNG">
                      <Download className="h-2.5 w-2.5" /> Save PNG
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="pointer-events-auto">
              <GardenMinimap
                plants={plants}
                structures={structures}
                shadeZones={shadeZones}
                settings={settings}
                cols={cols}
                rows={rows}
                panOffset={panOffset}
                containerRef={containerRef}
                showSunOverlay={showSunOverlay}
                onNavigate={(pan) => setPanOffset(clampPan(pan))}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}
