import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import ComputeWorker from '@/workers/gardenCompute.worker?worker';
import RenderWorker from '@/workers/gardenRender.worker?worker';
import { PlacedPlant, PlotSettings, PlacedStructure } from '@/types/garden';
import { getPlantById } from '@/data/plants';
import { getStructureById } from '@/data/structures';
import { calculateShadeZones } from '@/utils/sunCalculator';
import { getCompanionReason } from '@/data/companionReasons';
import { useFavouritePlants } from '@/hooks/useFavouritePlants';
import { buildCompanionHeatmap } from '@/utils/companionHeatmap';
import { getPlantSeasonStatus, type PlantSeasonStatus } from '@/utils/seasonalSowing';

// Extracted modules
import {
  roundRect,
  getCachedEmoji,
  resetCtx,
  scheduleFrame,
  cancelFrame,
  twemojiCache,
  customSpriteCache,
  preloadTwemojis,
  loadCustomSprite,
  getCachedPath2D,
} from './garden/gardenCanvasUtils';

import {
  buildCompanionMap,
  buildSpacingConflicts,
  buildSpatialBuckets,
  type CompanionInfo,
} from './garden/gardenDataBuilders';

import { useGardenZoomPan } from './garden/useGardenZoomPan';
import { useGardenDrag } from './garden/useGardenDrag';
import { GardenStructureTile } from './garden/GardenStructureTile';
import { GardenControlsPanel } from './garden/GardenControlsPanel';

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

export interface GardenGridProps {
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
  onMoveStructureStart?: () => void;
  selectedPlantId: string | null;
  onFillPlantArea?: (plantId: string, x: number, y: number, w: number, h: number) => void;
  onSmartAutoFill?: (x: number, y: number, w: number, h: number, isContainer: boolean) => void;
  onSettingsChange?: (s: PlotSettings) => void;
  pendingPlantId?: string | null;
  pendingIsStructure?: boolean;
  pendingStructureSize?: { w: number; h: number } | null;
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
  /** viewMonth: 0-11, used for seasonal tinting. null = live rendering (no seasonal effects). */
  viewMonth?: number | null;
  /** Called when a bed is selected for viewing/editing. */
  onSelectBed?: (bed: PlacedStructure | null) => void;
  /** When true, panning and zooming still work but all modifications (move/resize/place) are blocked. */
  locked?: boolean;
}

interface DragTooltip {
  x: number;
  y: number;
  plantId: string;
  gridX: number;
  gridY: number;
}

export function GardenGrid({ settings, plants, structures, onPlacePlant, onRemovePlant, onMovePlantStart, onMovePlant, onSelectPlant, onPlaceStructure, onRemoveStructure, onResizeStructure, onMoveStructure, onMoveStructureStart, selectedPlantId, onFillPlantArea, onSmartAutoFill, onSettingsChange, pendingPlantId, pendingIsStructure, pendingStructureSize, onCancelPending, structureMode: propStructureMode, showSunOverlay: propShowSunOverlay, onShowSunOverlayChange, isMobile, controlsPortalRef, canvasExportRef, viewMonth, onSelectBed, locked = false }: GardenGridProps) {
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
  const [internalShowSunOverlay, setInternalShowSunOverlay] = useState(propShowSunOverlay ?? true);
  const showSunOverlay = propShowSunOverlay ?? internalShowSunOverlay;
  const setShowSunOverlay = (show: boolean) => {
    setInternalShowSunOverlay(show);
    onShowSunOverlayChange?.(show);
  };
  const [showColorCoding, setShowColorCoding] = useState(true);
  const [showRotationOverlay, setShowRotationOverlay] = useState(false);
  const [layersPanelCollapsed, setLayersPanelCollapsed] = useState(true);
  const [newlyPlacedId, setNewlyPlacedId] = useState<string | null>(null);
  const [placementAnim, setPlacementAnim] = useState<{ x: number; y: number; emoji: string } | null>(null);
  const [hoveredPlantId, setHoveredPlantId] = useState<string | null>(null);
  const [spriteVersion, setSpriteVersion] = useState(0);
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const [infoTooltipId, setInfoTooltipId] = useState<string | null>(null);
  const [dragTooltip, setDragTooltip] = useState<DragTooltip | null>(null);
  const [companionWarning, setCompanionWarning] = useState<string | null>(null);

  const { getFavouriteIds } = useFavouritePlants();
  const favouriteIds = getFavouriteIds();

  // Scroll position for ruler measurements
  const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);
  const mainRafRef = useRef<number | null>(null);
  const overlayRafRef = useRef<number | null>(null);
  const mainRafPendingRef = useRef(false);
  const overlayRafPendingRef = useRef(false);
  const drawMainRef = useRef<(() => void) | null>(null);
  const drawOverlayRef = useRef<(() => void) | null>(null);
  const renderWorkerRef = useRef<Worker | null>(null);
  const renderIdRef = useRef(0);
  const dirtyRectsRef = useRef<{ x: number; y: number }[]>([]);
  const markDirty = useCallback((x: number, y: number) => {
    dirtyRectsRef.current.push({ x: Math.floor(x), y: Math.floor(y) });
  }, []);

  const cellSize = settings.cellSizePx;
  const cellsPerUnit = settings.unit === 'meters' ? (100 / settings.cellSizeCm) : (30.48 / settings.cellSizeCm);
  const cols = Math.round(settings.widthM * cellsPerUnit);
  const rows = Math.round(settings.heightM * cellsPerUnit);
  const gridW = cols * cellSize;
  const gridH = rows * cellSize;

  // ── Zoom / Pan ──
  const {
    panOffset,
    setPanOffset,
    panMode,
    panMovedRef,
    lastTapRef,
    clampPan,
    handlePanStart,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleCanvasPointerDown: handleZoomPanPointerDown,
  } = useGardenZoomPan({
    settings,
    onSettingsChange,
    gridW,
    gridH,
    cols,
    rows,
    cellSize,
    containerRef,
    isMobile,
  });

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
    const x = Math.round(Math.max(0, Math.min(rawX, cols - 1)) * 10) / 10;
    const y = Math.round(Math.max(0, Math.min(rawY, rows - 1)) * 10) / 10;
    return { x, y };
  }, [cellSize, cols, rows, settings.snapToGrid]);

  // ── Drag / Move / Resize ──
  const {
    moving,
    handleResizeStart,
    handleMoveStart,
    movingPlant,
    longPressPlantId,
    startLongPress,
    LONG_PRESS_DELAY_MS,
    plantResize,
  } = useGardenDrag({
    cellSize,
    cols,
    rows,
    structures,
    locked,
    isMobile,
    panMode,
    propStructureMode,
    onResizeStructure,
    onMoveStructure,
    onMoveStructureStart,
    onMovePlant,
    onMovePlantStart,
    onRemovePlant,
    onFillPlantArea,
    snapToGridFn,
  });

  // Sync external selectedPlantId into local selection state
  useEffect(() => {
    setInternalSelectedId(selectedPlantId ?? null);
  }, [selectedPlantId]);

  const shadeZones = useMemo(
    () => calculateShadeZones(structures, settings, cols, rows),
    [structures, settings, cols, rows]
  );

  // ── Companion/spacing/bucket/occupied data -- computed in a Web Worker
  const companionMapRef     = useRef<Map<string, CompanionInfo>>(buildCompanionMap(plants));
  const spacingConflictsRef = useRef<Map<string, string[]>>(buildSpacingConflicts(plants, settings.cellSizeCm));
  const spatialBucketsRef   = useRef<Map<string, PlacedPlant[]>>(buildSpatialBuckets(plants));
  const occupiedCellsRef    = useRef<Uint8Array>((() => {
    const arr = new Uint8Array(cols * rows);
    for (const p of plants) {
      const cx = Math.floor(p.x), cy = Math.floor(p.y);
      if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) arr[cy * cols + cx] = 1;
    }
    return arr;
  })());
  const companionMap     = companionMapRef.current;
  const spacingConflicts = spacingConflictsRef.current;
  const spatialBuckets   = spatialBucketsRef.current;
  const occupiedCells    = occupiedCellsRef.current;

  // Companion heatmap -- computed when a plant is being dragged or pending
  const activeDragPlantId = pendingPlantId ?? dragTooltip?.plantId ?? null;
  const companionHeatmap = useMemo(() => {
    if (!activeDragPlantId || pendingIsStructure) return null;
    return buildCompanionHeatmap(activeDragPlantId, plants, cols, rows);
  }, [activeDragPlantId, pendingIsStructure, plants, cols, rows]);

  // Singleton compute worker
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
  }, []);

  useEffect(() => {
    computeWorkerRef.current?.postMessage({
      type: 'compute',
      plants,
      cellSizeCm: settings.cellSizeCm,
      cols,
      rows,
    });
  }, [plants, settings.cellSizeCm, cols, rows]);

  // O(1) plant hit-test index
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

  const labelInterval = useMemo(
    () => settings.unit === 'meters'
      ? Math.round(100 / settings.cellSizeCm)
      : Math.round(30.48 / settings.cellSizeCm),
    [settings.unit, settings.cellSizeCm]
  );

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    setDragTooltip(null);
    const plantId = e.dataTransfer.getData('plantId');
    const structureId = e.dataTransfer.getData('structureId');
    const { x, y } = snapToGridFn(e.clientX, e.clientY);
    if (structureId) {
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
      const pData = getPlantById(newest.plantId);
      if (pData) {
        setPlacementAnim({ x: newest.x, y: newest.y, emoji: pData.emoji });
      }
      const timer = setTimeout(() => { setNewlyPlacedId(null); setPlacementAnim(null); }, 450);
      return () => clearTimeout(timer);
    }
  }, [plants]);

  // Preload Twemoji + custom sprites
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

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  const themeColors = useMemo(() => {
    const cssStyle = getComputedStyle(document.documentElement);
    const cardVal = cssStyle.getPropertyValue('--card').trim();
    const primaryVal = cssStyle.getPropertyValue('--primary').trim();
    return {
      bgColor: cardVal ? `hsl(${cardVal})` : (isDark ? '#111' : '#fff'),
      primaryColor: primaryVal ? `hsl(${primaryVal})` : '#22c55e',
    };
  }, [isDark]);

  // ── Render worker setup ──
  useEffect(() => {
    const worker = new RenderWorker();
    renderWorkerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      if (e.data.type === 'sprites-ready') {
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
      if (id !== renderIdRef.current) { bitmap.close(); return; }

      const canvas = mainCanvasRef.current;
      if (!canvas) { bitmap.close(); return; }

      if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.style.width = `${bitmap.width / 2}px`;
        canvas.style.height = `${bitmap.height / 2}px`;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) { bitmap.close(); return; }
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
    };

    drawMainRef.current?.();

    return () => {
      worker.terminate();
      renderWorkerRef.current = null;
    };
  }, []);

  // ── Main canvas renderer ──
  useEffect(() => {
    drawMainRef.current = () => {
      const canvas = mainCanvasRef.current;
      if (!canvas) return;
      const container = containerRef.current;
      const containerW = container?.clientWidth ?? gridW;
      const containerH = container?.clientHeight ?? gridH;
      const vpLeft   = Math.max(0,    Math.floor(-panOffset.x / cellSize) - 1);
      const vpTop    = Math.max(0,    Math.floor(-panOffset.y / cellSize) - 1);
      const vpRight  = Math.min(cols, Math.ceil((-panOffset.x + containerW) / cellSize) + 1);
      const vpBottom = Math.min(rows, Math.ceil((-panOffset.y + containerH) / cellSize) + 1);

      // Render worker path
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
          companionHeatmapCompanion: companionHeatmap?.companion ?? null,
          companionHeatmapEnemy: companionHeatmap?.enemy ?? null,
          baseUrl: import.meta.env.BASE_URL,
          vpLeft, vpTop, vpRight, vpBottom,
          viewMonth: viewMonth ?? null,
        });
        return;
      }

      // ── Fallback: draw directly on main thread ──
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

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

      const dirtyRects = dirtyRectsRef.current;
      dirtyRectsRef.current = [];
      const usePartialRepaint =
        dirtyRects.length > 0 && dirtyRects.length <= 16 &&
        !showSunOverlay && !showRotationOverlay;

      if (usePartialRepaint) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const pad = cellSize * 2;
        for (const { x, y } of dirtyRects) {
          ctx.clearRect(x * cellSize - pad, y * cellSize - pad, cellSize + pad * 2, cellSize + pad * 2);
        }
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
        ctx.save();
        ctx.beginPath();
        for (const { x, y } of dirtyRects) {
          ctx.rect(x * cellSize - pad, y * cellSize - pad, cellSize + pad * 2, cellSize + pad * 2);
        }
        ctx.clip();
      } else {
        resetCtx(ctx);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.save();
        roundRect(ctx, 0, 0, gridW, gridH, 8);
        ctx.clip();
      }

      const { bgColor, primaryColor } = themeColors;

      // Static layer: background + grid lines
      const staticKey = `${gridW},${gridH},${cols},${rows},${cellSize},${bgColor}`;
      if (!staticCanvasRef.current || staticLayerKeyRef.current !== staticKey) {
        const sl = document.createElement('canvas');
        sl.width = gridW * dpr;
        sl.height = gridH * dpr;
        const sCtx = sl.getContext('2d') as CanvasRenderingContext2D | null;
        if (sCtx) {
          sCtx.scale(dpr, dpr);
          sCtx.fillStyle = bgColor;
          sCtx.fillRect(0, 0, gridW, gridH);
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

      // Structure cell fills + bed perimeter strokes
      for (const struct of structures) {
        const data = getStructureById(struct.structureId);
        if (!data?.showCells) continue;
        ctx.fillStyle = data.color;
        ctx.globalAlpha = 0.6;
        const path = new Path2D();
        const cw = cellSize - 2;
        const ch = cellSize - 2;
        const r = Math.min(2, cw / 2, ch / 2);
        for (let row = 0; row < struct.heightCells; row++) {
          for (let col = 0; col < struct.widthCells; col++) {
            const x = (struct.x + col) * cellSize + 1;
            const y = (struct.y + row) * cellSize + 1;
            path.moveTo(x + r, y);
            path.arcTo(x + cw, y, x + cw, y + ch, r);
            path.arcTo(x + cw, y + ch, x, y + ch, r);
            path.arcTo(x, y + ch, x, y, r);
            path.arcTo(x, y, x + cw, y, r);
            path.closePath();
          }
        }
        ctx.fill(path);
        ctx.globalAlpha = 1;
        const bx = struct.x * cellSize;
        const by = struct.y * cellSize;
        const bw = struct.widthCells * cellSize;
        const bh = struct.heightCells * cellSize;
        roundRect(ctx, bx + 0.5, by + 0.5, bw - 1, bh - 1, 4);
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.22)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Sun/shade overlay
      if (showSunOverlay && shadeZones.size > 0) {
        const { getSunExposure } = require('@/utils/sunCalculator');
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

      // Rotation heatmap
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

      // Companion placement heatmap
      if (companionHeatmap) {
        for (let cy = vpTop; cy < vpBottom; cy++) {
          for (let cx = vpLeft; cx < vpRight; cx++) {
            const idx = cy * cols + cx;
            if (occupiedCells[idx] !== 0) continue;
            const cScore = companionHeatmap.companion[idx];
            const eScore = companionHeatmap.enemy[idx];
            if (eScore > 0 && eScore >= cScore) {
              ctx.fillStyle = `rgba(239,68,68,${Math.min(0.35, eScore * 0.12)})`;
            } else if (cScore > 0) {
              ctx.fillStyle = `rgba(34,197,94,${Math.min(0.35, cScore * 0.12)})`;
            } else {
              continue;
            }
            ctx.fillRect(cx * cellSize, cy * cellSize, cellSize, cellSize);
          }
        }
      }

      // Plant tiles -- multi-pass batched rendering
      const hasLabel = cellSize >= 20;
      const tilePath = getCachedPath2D(cellSize - 2, cellSize - 2, 5);
      const { categoryColors, categoryColorsDark } = require('@/data/companionReasons');
      const sortedPlants = [...plants].sort((a, b) => {
        const aData = getPlantById(a.plantId);
        const bData = getPlantById(b.plantId);
        return (aData?.category ?? '').localeCompare(bData?.category ?? '');
      });

      interface TileMeta {
        placed: PlacedPlant;
        plantData: ReturnType<typeof getPlantById>;
        px: number; py: number; pw: number; ph: number;
        tileBg: string;
        hasHighlight: boolean;
        relations: CompanionInfo | undefined;
        spacingIssues: string[] | undefined;
        growthPct: number;
        emojiSize: number;
        emojiOffsetY: number;
        seasonStatus: PlantSeasonStatus;
      }
      const tileMetas: TileMeta[] = [];
      for (const placed of sortedPlants) {
        const plantData = getPlantById(placed.plantId);
        if (!plantData) continue;
        const aw = placed.areaW ?? 1, ah = placed.areaH ?? 1;
        const ax = Math.floor(placed.x), ay = Math.floor(placed.y);
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
        const emojiSize = aw > 1 || ah > 1
          ? Math.max(Math.min(pw, ph) * 0.82, 20)
          : Math.max(cellSize * (0.88 + Math.min(0.1, growthPct * 0.1)), 20);
        const emojiOffsetY = aw > 1 || ah > 1 ? 0 : (hasLabel ? -5 : 0);
        const seasonStatus: PlantSeasonStatus = viewMonth != null
          ? getPlantSeasonStatus(plantData, placed.plantedAt, viewMonth)
          : 'active';
        tileMetas.push({ placed, plantData, px, py, pw, ph, tileBg, hasHighlight, relations, spacingIssues, growthPct, emojiSize, emojiOffsetY, seasonStatus });
      }

      // Pass A: normal tile fills
      const normalByBg = new Map<string, TileMeta[]>();
      const dormantNormal: TileMeta[] = [];
      const harvestedNormal: TileMeta[] = [];
      for (const m of tileMetas) {
        if (m.hasHighlight) continue;
        if (m.placed.stage === 'harvested') {
          harvestedNormal.push(m);
        } else if (m.seasonStatus === 'dormant') {
          dormantNormal.push(m);
        } else {
          if (!normalByBg.has(m.tileBg)) normalByBg.set(m.tileBg, []);
          normalByBg.get(m.tileBg)!.push(m);
        }
      }
      for (const [bg, group] of normalByBg) {
        ctx.fillStyle = bg;
        ctx.shadowColor = 'rgba(0,0,0,0.10)'; ctx.shadowBlur = 2;
        ctx.beginPath();
        for (const { px, py, pw, ph } of group) roundRect(ctx, px + 1, py + 1, pw - 2, ph - 2, 5);
        ctx.fill();
        ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
      }
      if (dormantNormal.length > 0) {
        const dormantBg = isDark ? 'hsl(0 0% 15%)' : 'hsl(0 0% 92%)';
        ctx.fillStyle = dormantBg;
        ctx.shadowColor = 'rgba(0,0,0,0.10)'; ctx.shadowBlur = 2;
        ctx.beginPath();
        for (const { px, py, pw, ph } of dormantNormal) roundRect(ctx, px + 1, py + 1, pw - 2, ph - 2, 5);
        ctx.fill();
        ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
      }
      if (harvestedNormal.length > 0) {
        const harvestedBg = isDark ? 'hsl(0 0% 18%)' : 'hsl(0 0% 88%)';
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = harvestedBg;
        ctx.beginPath();
        for (const { px, py, pw, ph } of harvestedNormal) roundRect(ctx, px + 1, py + 1, pw - 2, ph - 2, 5);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Pass B: highlighted tile fills
      for (const { placed, px, py, pw, ph, tileBg, relations, spacingIssues, seasonStatus } of tileMetas) {
        if (!relations?.hasEnemy && !relations?.hasCompanion && !spacingIssues?.length) continue;
        ctx.save();
        if (placed.stage === 'harvested') ctx.globalAlpha = 0.4;
        ctx.translate(px + 1, py + 1);
        if (relations?.hasEnemy) { ctx.shadowColor = 'rgba(239,68,68,0.35)'; ctx.shadowBlur = 8; }
        else if (relations?.hasCompanion) { ctx.shadowColor = 'rgba(34,197,94,0.3)'; ctx.shadowBlur = 8; }
        else { ctx.shadowColor = 'rgba(245,158,11,0.4)'; ctx.shadowBlur = 8; }
        const finalBg = placed.stage === 'harvested'
          ? (isDark ? 'hsl(0 0% 18%)' : 'hsl(0 0% 88%)')
          : seasonStatus === 'dormant' ? (isDark ? 'hsl(0 0% 15%)' : 'hsl(0 0% 92%)') : tileBg;
        ctx.fillStyle = finalBg;
        ctx.fill(pw === cellSize && ph === cellSize ? tilePath : getCachedPath2D(pw - 2, ph - 2, 5));
        ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
        ctx.restore();
      }

      // Pass C: emoji / custom sprites
      for (const { placed, plantData, px, py, pw, ph, emojiSize, emojiOffsetY, seasonStatus } of tileMetas) {
        const customBm = plantData!.sprite ? customSpriteCache.get(plantData!.sprite) : undefined;
        const twBm = !customBm ? twemojiCache.get(plantData!.emoji) : undefined;
        const cx = px + pw / 2, cy = py + ph / 2;
        const isHarvested = placed.stage === 'harvested';
        if (isHarvested) ctx.globalAlpha = 0.4;
        else if (seasonStatus === 'dormant') ctx.globalAlpha = 0.35;
        if (customBm || twBm) {
          const s = Math.round(emojiSize);
          ctx.drawImage((customBm ?? twBm)!, cx - s / 2, cy + emojiOffsetY - s / 2, s, s);
        } else {
          const emojiImg = getCachedEmoji(plantData!.emoji, emojiSize);
          ctx.drawImage(emojiImg, cx - emojiImg.width / 2, cy + emojiOffsetY - emojiImg.height / 2);
        }
        if (isHarvested || seasonStatus === 'dormant') ctx.globalAlpha = 1;
      }

      // Pass D: name labels
      if (hasLabel) {
        ctx.font = '600 8px system-ui,sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        for (const { plantData, px, py, pw, ph } of tileMetas) {
          const maxChars = cellSize >= 28 ? 7 : 5;
          const name = plantData!.name.length > maxChars ? plantData!.name.slice(0, maxChars - 1) + '\u2026' : plantData!.name;
          const tw = ctx.measureText(name).width;
          const pillW = Math.min(tw + 6, pw - 4);
          const pillH = 11;
          const pillX = px + (pw - pillW) / 2;
          const pillY = py + ph - pillH - 1;
          roundRect(ctx, pillX, pillY, pillW, pillH, 3);
          ctx.fillStyle = isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.75)';
          ctx.fill();
          ctx.fillStyle = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.8)';
          ctx.fillText(name, px + pw / 2, pillY + pillH - 2);
        }
      }

      // Pass E: stage badges
      ctx.font = '8px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      for (const { placed, px, py } of tileMetas) {
        const stageEmoji = placed.stage === 'harvested' ? '\uD83C\uDF3E'
          : placed.stage === 'seedling' ? '\uD83C\uDF31'
          : placed.stage === 'established' ? '\uD83C\uDF33'
          : '\uD83C\uDF30';
        const isHarvested = placed.stage === 'harvested';
        if (isHarvested) ctx.globalAlpha = 0.4;
        ctx.fillText(stageEmoji, px + 1, py + 1);
        if (isHarvested) ctx.globalAlpha = 1;
      }

      // Pass E.5: quantity badges
      if (cellSize >= 16) {
        ctx.font = `bold ${Math.max(7, Math.round(cellSize * 0.22))}px system-ui,sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const { placed, px, py, pw } of tileMetas) {
          const qty = placed.quantity ?? 1;
          if (qty <= 1) continue;
          const text = `\u00D7${qty}`;
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

      // Pass F: bottom badges
      if (cellSize >= 20) {
        for (const { plantData, px, py, pw, ph, relations, spacingIssues, seasonStatus } of tileMetas) {
          let badgeText = '';
          let badgeBg = '';
          if (seasonStatus === 'harvest-ready') { badgeText = '\uD83C\uDF3E Ready'; badgeBg = 'hsl(38 92% 50%)'; }
          else if (spacingIssues?.length && !relations?.hasEnemy) { badgeText = '\u2194 Too close'; badgeBg = 'hsl(38 92% 50%)'; }
          else if (relations?.hasEnemy && relations.enemyNames.length > 0) { badgeText = `\u274C ${relations.enemyNames[0]}`; badgeBg = 'hsl(0 84% 60%)'; }
          else if (relations?.hasCompanion && !relations.hasEnemy && relations.companionNames.length > 0 && cellSize >= 24) { badgeText = `\u2705 ${relations.companionNames[0]}`; badgeBg = primaryColor; }
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

      // Growth rings
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

      // Companion / enemy arcs
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

      // Seasonal ground tinting
      if (viewMonth != null) {
        const seasonTints: Record<number, string> = {
          0: 'rgba(180,200,220,0.06)', 1: 'rgba(180,200,220,0.05)',
          2: 'rgba(144,238,144,0.05)', 3: 'rgba(144,238,144,0.06)',
          4: 'rgba(144,238,144,0.04)', 5: 'rgba(255,235,150,0.05)',
          6: 'rgba(255,230,120,0.06)', 7: 'rgba(255,220,100,0.06)',
          8: 'rgba(255,180,80,0.05)', 9: 'rgba(200,140,60,0.06)',
          10: 'rgba(160,140,120,0.06)', 11: 'rgba(180,200,220,0.06)',
        };
        const tint = seasonTints[viewMonth];
        if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, gridW, gridH); }
      }

      ctx.restore();
    };

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridW, gridH, cols, rows, cellSize, isDark, plants, shadeZones, showSunOverlay, showRotationOverlay, showColorCoding, settings.cellSizeCm, structures, themeColors, spriteVersion, layoutVersion, panOffset, companionHeatmap, viewMonth]);

  // ── Overlay canvas ──
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

      // Hover cell highlight
      if (hoverCell && !pendingPlantId) {
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
        roundRect(ctx, hoverCell.x * cellSize + 1, hoverCell.y * cellSize + 1, cellSize - 2, cellSize - 2, 4);
        ctx.fill();
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Hover tile border
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

      // Selection tile border + spacing halo
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

      // Pending plant ghost
      if (pendingPlantId && !pendingIsStructure && hoverCell) {
        const ghostPlant = getPlantById(pendingPlantId);
        if (ghostPlant) {
          const gx = hoverCell.x * cellSize, gy = hoverCell.y * cellSize;
          const isOccupied = (hoverCell.x >= 0 && hoverCell.x < cols && hoverCell.y >= 0 && hoverCell.y < rows && occupiedCells[hoverCell.y * cols + hoverCell.x] !== 0);

          ctx.fillStyle = isOccupied ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)';
          roundRect(ctx, gx + 1, gy + 1, cellSize - 2, cellSize - 2, 5);
          ctx.fill();

          ctx.strokeStyle = isOccupied ? 'rgba(239,68,68,0.6)' : 'rgba(34,197,94,0.6)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 3]);
          roundRect(ctx, gx + 1, gy + 1, cellSize - 2, cellSize - 2, 5);
          ctx.stroke();
          ctx.setLineDash([]);

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

      // Pending structure ghost
      if (pendingPlantId && pendingIsStructure && hoverCell) {
        const structDef = getStructureById(pendingPlantId);
        const gw = (pendingStructureSize?.w ?? structDef?.widthCells ?? 1) * cellSize;
        const gh = (pendingStructureSize?.h ?? structDef?.heightCells ?? 1) * cellSize;
        const gx = hoverCell.x * cellSize;
        const gy = hoverCell.y * cellSize;

        ctx.fillStyle = structDef?.color
          ? structDef.color.replace(/[\d.]+\)$/, '0.15)')
          : 'rgba(34,197,94,0.10)';
        roundRect(ctx, gx + 1, gy + 1, gw - 2, gh - 2, 6);
        ctx.fill();

        ctx.strokeStyle = 'rgba(34,197,94,0.75)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        roundRect(ctx, gx + 1, gy + 1, gw - 2, gh - 2, 6);
        ctx.stroke();
        ctx.setLineDash([]);

        if (structDef) {
          const emojiSize = Math.max(Math.min(gw, gh) * 0.35, 16);
          const eImg = getCachedEmoji(structDef.emoji, emojiSize);
          ctx.globalAlpha = 0.6;
          ctx.drawImage(eImg, gx + gw / 2 - eImg.width / 2, gy + gh / 2 - eImg.height / 2);
          ctx.globalAlpha = 1;
        }
      }

      // Plant resize preview
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
  }, [plantResize, occupiedCells, gridW, gridH, cols, rows, cellSize, themeColors, hoverCell, pendingPlantId, pendingIsStructure, pendingStructureSize, settings.cellSizeCm, isDark, spriteVersion, layoutVersion, internalSelectedId, plants]);

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
      .map(p => ({ distance: Math.sqrt(Math.pow(p.x - dragTooltip.gridX, 2) + Math.pow(p.y - dragTooltip.gridY, 2)) }))
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

  // Track scroll position
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => {
      setScrollPos({ x: container.scrollLeft, y: container.scrollTop });
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Font pre-warming
  useEffect(() => {
    const warm = new OffscreenCanvas(1, 1);
    const ctx = warm.getContext('2d');
    if (!ctx) return;
    for (const font of ['600 7px system-ui,sans-serif', '8px sans-serif', '600 6px system-ui,sans-serif']) {
      ctx.font = font;
      ctx.fillText('A', -99, -99);
    }
  }, []);

  // Detect container resize and devicePixelRatio changes
  useEffect(() => {
    const container = containerRef.current;
    if (typeof ResizeObserver !== 'undefined' && container) {
      const ro = new ResizeObserver(() => setLayoutVersion(v => v + 1));
      ro.observe(container);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (container as any).__roDisconnect = () => ro.disconnect();
    }
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (container as any)?.__roDisconnect?.();
    };
  }, []);

  // Canvas export
  if (canvasExportRef) {
    canvasExportRef.current = async (scale = 1) => {
      const canvas = mainCanvasRef.current;
      if (!canvas) return null;
      if (scale <= 1) {
        return canvas.toDataURL('image/png', 1.0);
      }
      const hiRes = new OffscreenCanvas(gridW * scale, gridH * scale);
      const hCtx = hiRes.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
      if (!hCtx) return canvas.toDataURL('image/png', 1.0);

      hCtx.setTransform(scale, 0, 0, scale, 0, 0);
      hCtx.save();
      roundRect(hCtx as unknown as CanvasRenderingContext2D, 0, 0, gridW, gridH, 8);
      hCtx.clip();

      const { bgColor } = themeColors;
      hCtx.fillStyle = bgColor;
      hCtx.fillRect(0, 0, gridW, gridH);
      const staticKey = `${gridW},${gridH},${cols},${rows},${cellSize},${bgColor}`;
      if (staticBitmapRef.current && staticBitmapKeyRef.current === staticKey) {
        hCtx.drawImage(staticBitmapRef.current, 0, 0, gridW, gridH);
      } else if (staticCanvasRef.current) {
        hCtx.drawImage(staticCanvasRef.current, 0, 0, gridW, gridH);
      }

      const { categoryColors: cc, categoryColorsDark: ccd } = require('@/data/companionReasons');
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
        const catColor = isDark ? ccd[plantData.category] : cc[plantData.category];
        const tileBg = isDark
          ? (relations?.hasEnemy ? 'hsl(0 30% 14%)' : relations?.hasCompanion ? 'hsl(142 25% 14%)' : catColor || 'hsl(25 20% 12%)')
          : (relations?.hasEnemy ? 'hsl(0 60% 95%)' : relations?.hasCompanion ? 'hsl(142 40% 93%)' : catColor || 'hsl(25 30% 94%)');
        const px = placed.x * cellSize, py = placed.y * cellSize;
        const pw = aw * cellSize, ph = ah * cellSize;
        hCtx.fillStyle = tileBg;
        roundRect(hCtx as unknown as CanvasRenderingContext2D, px + 1, py + 1, pw - 2, ph - 2, 5);
        hCtx.fill();
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
          const name = plantData.name.length > 6 ? plantData.name.slice(0, 5) + '\u2026' : plantData.name;
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

  // ── Canvas interaction handlers ──
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (panMovedRef.current) {
      panMovedRef.current = false;
      return;
    }
    if (panMode || locked) return;
    const { x, y } = snapToGridFn(e.clientX, e.clientY);

    if (!pendingPlantId && isMobile) {
      const now = Date.now();
      const last = lastTapRef.current;
      const dx = Math.abs(e.clientX - last.x);
      const dy = Math.abs(e.clientY - last.y);
      if (now - last.time < 350 && dx < 30 && dy < 30) {
        const currentSize = settings.cellSizePx;
        const newSize = currentSize <= 28 ? 44 : 24;
        onSettingsChange?.({ ...settings, cellSizePx: newSize });
        navigator.vibrate?.(10);
        lastTapRef.current = { time: 0, x: 0, y: 0 };
        return;
      }
      lastTapRef.current = { time: now, x: e.clientX, y: e.clientY };
    }

    if (pendingPlantId && !pendingIsStructure) {
      markDirty(x, y);
      onPlacePlant(pendingPlantId, x, y);
      onCancelPending?.();
      navigator.vibrate?.(12);
      return;
    }
    if (pendingPlantId && pendingIsStructure) {
      onPlaceStructure(pendingPlantId, Math.round(x), Math.round(y));
      onCancelPending?.();
      navigator.vibrate?.(15);
      return;
    }
    if (!propStructureMode) {
      const cellX = Math.floor(x), cellY = Math.floor(y);
      const plant = plantCellIndex.get(`${cellX},${cellY}`);
      if (plant) {
        setInternalSelectedId(null);
        onSelectPlant(plant);
      } else {
        setInternalSelectedId(null);
        onSelectPlant(null);
      }
    } else {
      setInternalSelectedId(null);
      onSelectPlant(null);
    }
  }, [panMode, locked, snapToGridFn, pendingPlantId, pendingIsStructure, plantCellIndex, propStructureMode, markDirty, onPlacePlant, onPlaceStructure, onCancelPending, onSelectPlant, isMobile, settings, onSettingsChange, panMovedRef, lastTapRef]);

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    handleZoomPanPointerDown(e);
  }, [handleZoomPanPointerDown]);

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    const coalesced = e.nativeEvent.getCoalescedEvents?.();
    const finalEvent = coalesced?.length ? coalesced[coalesced.length - 1] : e.nativeEvent;
    const { x, y } = snapToGridFn(finalEvent.clientX, finalEvent.clientY);
    const cellX = Math.floor(x), cellY = Math.floor(y);
    setHoverCell({ x: cellX, y: cellY });
    if (movingPlant || propStructureMode) { setHoveredPlantId(null); setCompanionWarning(null); return; }
    const plant = plantCellIndex.get(`${cellX},${cellY}`);
    setHoveredPlantId(plant?.id ?? null);

    if (pendingPlantId && !pendingIsStructure) {
      const pendingData = getPlantById(pendingPlantId);
      const enemies = pendingData?.enemies ?? [];
      if (enemies.length > 0) {
        let warning: string | null = null;
        for (const placed of plants) {
          if (!enemies.includes(placed.plantId)) continue;
          const dist = Math.abs(Math.floor(placed.x) - cellX) + Math.abs(Math.floor(placed.y) - cellY);
          if (dist <= 3) {
            const enemyData = getPlantById(placed.plantId);
            if (enemyData) {
              warning = `\u26A0\uFE0F ${enemyData.name} nearby -- poor companion`;
              break;
            }
          }
        }
        setCompanionWarning(warning);
      } else {
        setCompanionWarning(null);
      }
    } else {
      setCompanionWarning(null);
    }
  }, [movingPlant, propStructureMode, snapToGridFn, plantCellIndex, pendingPlantId, pendingIsStructure, plants]);

  const handleCanvasContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className="w-full h-full relative">
      {/* Left Ruler */}
      {!isMobile && (
        <div style={{
          position: 'absolute', left: 0, top: 0, width: '60px',
          backgroundColor: '#f0f0f0', borderRight: '1px solid #ddd',
          zIndex: 40, height: '100%', overflow: 'hidden'
        }}>
          <div style={{ transform: `translateY(${panOffset.y}px)`, position: 'relative' }}>
            {Array.from({ length: rows }).map((_, i) => {
              if (i % labelInterval !== 0) return null;
              const distance = i * settings.cellSizeCm;
              const label = settings.unit === 'meters'
                ? `${Math.round(distance / 100)}m`
                : `${Math.round(distance / 30.48)}ft`;
              return (
                <div key={`row-${i}`} style={{
                  position: 'absolute', left: 0, top: i * cellSize, width: '60px', height: cellSize,
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                  paddingRight: '4px', fontSize: '10px', fontWeight: '600',
                }}>{label}</div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Ruler */}
      {!isMobile && (
        <div style={{
          position: 'absolute', top: 0, left: 60, right: 0, height: '20px',
          backgroundColor: '#f0f0f0', borderBottom: '1px solid #ddd',
          zIndex: 40, overflow: 'hidden'
        }}>
          <div style={{ transform: `translateX(${panOffset.x}px)`, position: 'relative', height: '100%' }}>
            {Array.from({ length: cols }).map((_, i) => {
              if (i % labelInterval !== 0) return null;
              const distance = i * settings.cellSizeCm;
              const label = settings.unit === 'meters'
                ? `${Math.round(distance / 100)}m`
                : `${Math.round(distance / 30.48)}ft`;
              return (
                <span key={`col-${i}`} style={{
                  position: 'absolute', left: i * cellSize, width: cellSize,
                  textAlign: 'center', fontSize: '10px', fontWeight: '600', top: '2px',
                }}>{label}</span>
              );
            })}
          </div>
        </div>
      )}

      {/* Canvas Container */}
      <div
        style={{
          position: 'absolute', top: isMobile ? 0 : 20, left: isMobile ? 0 : 60,
          right: 0, bottom: 0, overflow: 'hidden'
        }}
        ref={containerRef}
        onWheel={handleWheel}
        onPointerDown={handlePanStart}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          style={{
            width: gridW, height: gridH,
            transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
            transformOrigin: 'top left', position: 'relative',
            touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
            cursor: pendingPlantId
              ? 'crosshair'
              : hoveredPlantId && !propStructureMode
                ? (movingPlant || longPressPlantId ? 'grabbing' : 'pointer')
                : panMode ? 'grab' : 'default',
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={() => { setDragOver(false); setDragTooltip(null); }}
          onClick={handleCanvasClick}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onContextMenu={handleCanvasContextMenu}
          onMouseLeave={() => { setHoveredPlantId(null); setHoverCell(null); setInfoTooltipId(null); setCompanionWarning(null); }}
        >
          {/* Main canvas */}
          <canvas
            ref={mainCanvasRef}
            role="img"
            aria-label={`Garden grid showing ${plants.length} planted items on a ${cols} by ${rows} cell grid`}
            className={`absolute rounded-lg border-2 transition-colors pointer-events-none ${dragOver ? 'border-primary' : 'border-border'}`}
            style={{ left: 0, top: 0, zIndex: 0, willChange: 'transform' }}
          />

          {/* Overlay canvas */}
          <canvas
            ref={overlayCanvasRef}
            className="absolute pointer-events-none"
            style={{ left: 0, top: 0, zIndex: 5, willChange: 'transform' }}
          />

          {/* Long-press charge ring */}
          {longPressPlantId && (() => {
            const lpp = plants.find(p => p.id === longPressPlantId);
            if (!lpp) return null;
            const px = Math.floor(lpp.x) * cellSize;
            const py = Math.floor(lpp.y) * cellSize;
            return (
              <div
                key={longPressPlantId}
                className="pointer-events-none absolute"
                style={{
                  left: px - 4, top: py - 4, width: cellSize + 8, height: cellSize + 8,
                  borderRadius: 10, border: '3px solid hsl(var(--primary))',
                  zIndex: 50, animation: `longPressCharge ${LONG_PRESS_DELAY_MS}ms ease-in forwards`,
                }}
              />
            );
          })()}

          {/* Drag preview circle */}
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

          {/* Resize preview size label */}
          {plantResize && (plantResize.currentW > 1 || plantResize.currentH > 1) && (
            <div className="absolute pointer-events-none z-20" style={{ left: plantResize.originX * cellSize, top: plantResize.originY * cellSize }}>
              <span className="absolute -top-5 left-0 text-[10px] font-medium text-primary bg-card px-1 rounded">
                {plantResize.currentW}\u00D7{plantResize.currentH}
              </span>
            </div>
          )}

          {/* Placed structures */}
          {structures.map(struct => (
            <GardenStructureTile
              key={struct.id}
              struct={struct}
              structures={structures}
              plants={plants}
              settings={settings}
              cellSize={cellSize}
              isMobile={isMobile}
              isMoving={moving?.id === struct.id}
              locked={locked}
              favouriteIds={favouriteIds}
              onRemoveStructure={onRemoveStructure}
              onResizeStructure={onResizeStructure}
              onResizeStart={handleResizeStart}
              onMoveStart={handleMoveStart}
              onSelectBed={onSelectBed}
              onSmartAutoFill={onSmartAutoFill}
              onDragStartPlant={(e, plantId) => e.dataTransfer.setData('plantId', plantId)}
            />
          ))}

          {/* Drag tooltip */}
          {dragOver && dragTooltip && (
            <div
              className="absolute pointer-events-none z-30 bg-card/95 backdrop-blur-sm text-foreground text-[10px] px-2 py-1 rounded-lg border border-border shadow-md max-w-[200px]"
              style={{ left: dragTooltip.gridX * cellSize + cellSize + 4, top: dragTooltip.gridY * cellSize }}
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
                      {'\u2705'} Near {dragPreview.companionData.name}: {dragPreview.companionReason || 'helpful companion'}
                    </p>
                  )}
                  {dragPreview.enemyData && (
                    <p className="text-destructive">
                      {'\u274C'} Avoid {dragPreview.enemyData.name}: {dragPreview.enemyReason || 'poor neighbour'}
                    </p>
                  )}
                </div>
              ) : <span className="text-muted-foreground">Drop item here</span>}
            </div>
          )}

          {/* Placement pop animation */}
          {placementAnim && (
            <>
              <div
                className="absolute pointer-events-none z-20"
                style={{
                  left: placementAnim.x * cellSize + cellSize / 2, top: placementAnim.y * cellSize + cellSize / 2,
                  width: cellSize, height: cellSize,
                  marginLeft: -cellSize / 2, marginTop: -cellSize / 2,
                  animation: 'plantPop 0.4s ease-out forwards',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: cellSize * 0.7,
                }}
              >
                {placementAnim.emoji}
              </div>
              <div
                className="absolute pointer-events-none z-10 rounded-full border-2 border-primary/40"
                style={{
                  left: placementAnim.x * cellSize + cellSize / 2, top: placementAnim.y * cellSize + cellSize / 2,
                  width: cellSize, height: cellSize,
                  marginLeft: -cellSize / 2, marginTop: -cellSize / 2,
                  animation: 'plantRipple 0.45s ease-out forwards',
                }}
              />
            </>
          )}

          {/* Drag emoji preview */}
          {dragOver && dragTooltip && (() => {
            const pd = getPlantById(dragTooltip.plantId);
            if (!pd) return null;
            return (
              <div
                className="absolute pointer-events-none z-20 flex items-center justify-center opacity-50"
                style={{ left: dragTooltip.gridX * cellSize, top: dragTooltip.gridY * cellSize, width: cellSize, height: cellSize, fontSize: cellSize * 0.75 }}
              >
                {pd.emoji}
              </div>
            );
          })()}

          {/* Companion warning tooltip */}
          {companionWarning && hoverCell && pendingPlantId && (
            <div
              className="absolute pointer-events-none z-40 bg-amber-50 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200 text-[10px] font-medium px-2 py-1 rounded-lg border border-amber-300 dark:border-amber-600 shadow-md max-w-[200px]"
              style={{ left: Math.min((hoverCell.x + 1) * cellSize + 4, gridW - 210), top: Math.max(hoverCell.y * cellSize - 4, 0) }}
            >
              {companionWarning}
            </div>
          )}

          {/* Info button */}
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

          {/* Info tooltip */}
          {infoTooltipId && (() => {
            const plant = plants.find(p => p.id === infoTooltipId);
            const plantData = plant && getPlantById(plant.plantId);
            if (!plant || !plantData) return null;
            const relations = companionMap.get(plant.id);
            const spacingIssues = spacingConflicts.get(plant.id);
            const daysSincePlanted = plant.plantedAt ? Math.floor((Date.now() - new Date(plant.plantedAt).getTime()) / 86400000) : 0;
            const lines: string[] = [`${plantData.name} (${plant.stage}, ${daysSincePlanted}d)`];
            if (spacingIssues) lines.push(`\u26A0\uFE0F ${spacingIssues[0]}`);
            if (relations?.hasCompanion && relations.companionNames.length > 0) lines.push(`\u2705 Good with: ${relations.companionNames.join(', ')}`);
            if (relations?.hasEnemy && relations.enemyNames.length > 0) lines.push(`\u274C Bad with: ${relations.enemyNames.join(', ')}`);
            if (relations?.reasons?.[0]) lines.push(`\uD83D\uDCA1 ${relations.reasons[0]}`);
            lines.push('Click \u2139 to open full info \u00B7 Drag handles to fill');
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
                <span className="text-3xl block mb-2">{'\uD83C\uDF31'}</span>
                <p className="text-muted-foreground text-sm font-medium">
                  Drag plants from the sidebar to start!
                </p>
                <p className="text-muted-foreground text-xs mt-1 hidden sm:block">
                  Drag edges to fill rows {'\u00B7'} Right-click to remove {'\u00B7'} Ctrl+Scroll to zoom
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

      {/* Controls panel (minimap + layers) */}
      <GardenControlsPanel
        plants={plants}
        structures={structures}
        shadeZones={shadeZones}
        settings={settings}
        cols={cols}
        rows={rows}
        panOffset={panOffset}
        containerRef={containerRef}
        showSunOverlay={showSunOverlay}
        showRotationOverlay={showRotationOverlay}
        onSetRotationOverlay={setShowRotationOverlay}
        layersPanelCollapsed={layersPanelCollapsed}
        onSetLayersPanelCollapsed={setLayersPanelCollapsed}
        onNavigate={(pan) => setPanOffset(clampPan(pan))}
        mainCanvasRef={mainCanvasRef}
        controlsPortalRef={controlsPortalRef}
        isMobile={isMobile}
      />
    </div>
  );
}
