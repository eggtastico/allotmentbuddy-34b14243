/**
 * IsometricGardenGrid — production canvas renderer
 *
 * Architecture:
 *  • Two stacked <canvas> elements: mainCanvas (scene) + overlayCanvas (hover/ghost)
 *  • ResizeObserver keeps canvas dimensions matched to the container
 *  • Pure JS drawing — no workers needed at typical allotment grid sizes (≤40×30)
 *  • Painter's algorithm: all render items sorted by painterKey (col+row) before draw
 *  • Area plants are exploded into per-cell render items for correct depth ordering
 *  • Structures rendered as 3D iso boxes (top face + SW face + SE face)
 *  • Soil texture uses deterministic cellNoise — no Math.random(), stable renders
 *  • Zoom-to-cursor on wheel; right-drag or middle-drag to pan
 */

import React, {
  useRef, useEffect, useState, useCallback, useMemo, useLayoutEffect, createPortal,
} from 'react';
import { PlacedPlant, PlacedStructure, PlotSettings } from '@/types/garden';
import { getPlantById } from '@/data/plants';
import { getStructureById } from '@/data/structures';
import { calculateShadeZones, getSunExposure } from '@/utils/sunCalculator';
import {
  tileW, tileH,
  gridToScreen, gridToScreenCenter,
  screenToGrid, clampGrid, painterKey, cellNoise,
} from '@/utils/isoProjection';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── types ──────────────────────────────────────────────────────────────────

interface IsometricGardenGridProps {
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
  controlsPortalRef?: { current: HTMLElement | null };
  canvasExportRef?: React.MutableRefObject<((scale?: number) => Promise<string | null>) | null>;
}

// ─── constants ───────────────────────────────────────────────────────────────

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 3.5;
const INITIAL_ZOOM = 1.0;

// Box depth (px at zoom=1) per structure type
const STRUCTURE_DEPTH: Record<string, number> = {
  'raised-bed': 10, 'growing-bed': 8, 'flower-bed': 6, 'herb-bed': 6,
  'border': 4, 'fruit-cage': 18, 'greenhouse': 42, 'polytunnel': 36,
  'cold-frame': 12, 'shed': 46, 'compost-bin': 14, 'water-butt': 20,
  'pot-round': 16, 'pot-rect': 16, 'basket-round': 12, 'basket-rect': 10,
  'grow-bag': 8, 'fruit-tree': 30, 'tree': 36, 'path': 4, 'fence': 22,
};

// Top-face base colors per structure (canvas fillStyle)
const STRUCT_TOP: Record<string, string> = {
  'raised-bed': '#8B6347', 'growing-bed': '#7A5C40', 'flower-bed': '#C47A8A',
  'herb-bed': '#5A8C5A', 'border': '#B8884A', 'fruit-cage': '#7A7A7A',
  'greenhouse': '#A8D4E8', 'polytunnel': '#B8E0C0', 'cold-frame': '#D4E8A8',
  'shed': '#886644', 'compost-bin': '#6A7A40', 'water-butt': '#4A7AB0',
  'pot-round': '#C46040', 'pot-rect': '#C46040', 'basket-round': '#B07040',
  'basket-rect': '#C08040', 'grow-bag': '#666666', 'fruit-tree': '#5A8A3A',
  'tree': '#4A7A4A', 'path': '#C8B89A', 'fence': '#8B6844',
};

// Plant stage emoji size scale factor (relative to tileH)
const STAGE_SCALE: Record<string, number> = { seed: 0.42, seedling: 0.65, established: 0.90 };

// Soil colour pair: [lighter, darker] for checkerboard
const SOIL_LIGHT = '#D4B896';
const SOIL_DARK  = '#C8A882';

// ─── pure drawing helpers ────────────────────────────────────────────────────

/** Draw a flat ground tile (diamond top face only — no depth) */
function drawGroundTile(
  ctx: CanvasRenderingContext2D,
  col: number, row: number,
  zoom: number, ox: number, oy: number,
  fillStyle: string,
  strokeAlpha = 0.15,
) {
  const { sx, sy } = gridToScreen(col, row, zoom, ox, oy);
  const hw = tileW(zoom) / 2;
  const hh = tileH(zoom) / 2;

  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + hw, sy + hh);
  ctx.lineTo(sx, sy + hh * 2);
  ctx.lineTo(sx - hw, sy + hh);
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (strokeAlpha > 0) {
    ctx.strokeStyle = `rgba(0,0,0,${strokeAlpha})`;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
}

/** Draw a 3-face isometric box (one grid cell, extruded down by `depth` px at zoom=1) */
function drawIsoBox(
  ctx: CanvasRenderingContext2D,
  col: number, row: number,
  zoom: number, ox: number, oy: number,
  topColor: string,
  leftColor: string,
  rightColor: string,
  depth: number,   // px at zoom=1
) {
  const { sx, sy } = gridToScreen(col, row, zoom, ox, oy);
  const hw = tileW(zoom) / 2;
  const hh = tileH(zoom) / 2;
  const d  = depth * zoom;

  // Diamond corner points (top face)
  const T  = { x: sx,      y: sy         }; // top  tip
  const R  = { x: sx + hw, y: sy + hh    }; // right tip
  const B  = { x: sx,      y: sy + hh*2  }; // bottom tip
  const L  = { x: sx - hw, y: sy + hh    }; // left  tip

  // SW wall (left face): L → B → B+d → L+d
  ctx.beginPath();
  ctx.moveTo(L.x, L.y);
  ctx.lineTo(B.x, B.y);
  ctx.lineTo(B.x, B.y + d);
  ctx.lineTo(L.x, L.y + d);
  ctx.closePath();
  ctx.fillStyle = leftColor;
  ctx.fill();

  // SE wall (right face): B → R → R+d → B+d
  ctx.beginPath();
  ctx.moveTo(B.x, B.y);
  ctx.lineTo(R.x, R.y);
  ctx.lineTo(R.x, R.y + d);
  ctx.lineTo(B.x, B.y + d);
  ctx.closePath();
  ctx.fillStyle = rightColor;
  ctx.fill();

  // Top face (drawn last — covers wall seams)
  ctx.beginPath();
  ctx.moveTo(T.x, T.y);
  ctx.lineTo(R.x, R.y);
  ctx.lineTo(B.x, B.y);
  ctx.lineTo(L.x, L.y);
  ctx.closePath();
  ctx.fillStyle = topColor;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 0.7;
  ctx.stroke();
}

/** Derive darker shades of a hex colour for left/right faces */
function shadeHex(hex: string, factor: number): string {
  // factor < 1 = darker, > 1 = lighter
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v * factor)));
  return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`;
}

// ─── render item types ────────────────────────────────────────────────────────

interface RenderItem {
  sortKey: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

// ─── component ────────────────────────────────────────────────────────────────

export const IsometricGardenGrid: React.FC<IsometricGardenGridProps> = ({
  settings,
  plants,
  structures,
  onPlacePlant,
  onRemovePlant,
  onMovePlantStart,
  onMovePlant,
  onSelectPlant,
  onPlaceStructure,
  showSunOverlay,
  onShowSunOverlayChange,
  selectedPlantId,
  pendingPlantId,
  pendingIsStructure,
  onCancelPending,
  canvasExportRef,
  controlsPortalRef,
}) => {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mainRef       = useRef<HTMLCanvasElement>(null);
  const overlayRef    = useRef<HTMLCanvasElement>(null);

  // ── zoom / pan ──────────────────────────────────────────────────────────────
  const [zoom,    setZoom   ] = useState(INITIAL_ZOOM);
  const [originX, setOriginX] = useState(0);
  const [originY, setOriginY] = useState(0);
  const [canvasW,  setCanvasW] = useState(0);
  const [canvasH,  setCanvasH] = useState(0);

  // ── interaction ─────────────────────────────────────────────────────────────
  const isPanningRef   = useRef(false);
  const panStartRef    = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);
  const draggingIdRef  = useRef<string | null>(null);
  const [hoverCell, setHoverCell] = useState<{ col: number; row: number } | null>(null);

  // ── overlays ────────────────────────────────────────────────────────────────
  const [sunOverlay, setSunOverlay] = useState(showSunOverlay ?? false);

  // ── grid dimensions ─────────────────────────────────────────────────────────
  const cellsPerM = settings.unit === 'meters'
    ? 100 / settings.cellSizeCm
    : 30.48 / settings.cellSizeCm;
  const gridW = Math.max(1, Math.round(settings.widthM  * cellsPerM));
  const gridH = Math.max(1, Math.round(settings.heightM * cellsPerM));

  // ── shade zones (memoised — expensive) ──────────────────────────────────────
  const shadeZones = useMemo(
    () => sunOverlay ? calculateShadeZones(structures, settings, gridW, gridH) : new Set<string>(),
    [structures, settings, gridW, gridH, sunOverlay],
  );

  // ── ResizeObserver ───────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width < 1 || height < 1) return;
      setCanvasW(Math.round(width));
      setCanvasH(Math.round(height));
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ── Centre grid on first valid canvas size ──────────────────────────────────
  const centredRef = useRef(false);
  useEffect(() => {
    if (centredRef.current || canvasW < 1 || canvasH < 1) return;
    const z = INITIAL_ZOOM;
    // Screen position (relative to origin) of grid centre
    const gCX = (gridW / 2 - gridH / 2) * tileW(z) / 2;
    const gCY = (gridW / 2 + gridH / 2) * tileH(z) / 2;
    setOriginX(canvasW / 2 - gCX);
    setOriginY(canvasH * 0.22 - gCY + gridH * tileH(z) / 2);
    centredRef.current = true;
  }, [canvasW, canvasH, gridW, gridH]);

  // ── Build sorted render list (structures + plants) ──────────────────────────
  const renderItems = useMemo<RenderItem[]>(() => {
    const items: RenderItem[] = [];

    // Structures: per-cell box + one label per structure
    structures.forEach(s => {
      const def = getStructureById(s.structureId);
      if (!def) return;
      const depth   = STRUCTURE_DEPTH[s.structureId] ?? 12;
      const topHex  = STRUCT_TOP[s.structureId] ?? '#999999';
      const leftClr = shadeHex(topHex, 0.65);
      const rightClr= shadeHex(topHex, 0.80);

      // Box cells
      for (let dr = 0; dr < s.heightCells; dr++) {
        for (let dc = 0; dc < s.widthCells; dc++) {
          const col = s.x + dc;
          const row = s.y + dr;
          const sk  = painterKey(col, row);
          items.push({
            sortKey: sk,
            draw: (ctx) => drawIsoBox(ctx, col, row, zoom, originX, originY, topHex, leftClr, rightClr, depth),
          });
        }
      }

      // Emoji label — drawn after all cells, at the center cell
      const cCol  = s.x + Math.floor(s.widthCells / 2);
      const cRow  = s.y + Math.floor(s.heightCells / 2);
      const maxSK = painterKey(s.x + s.widthCells - 1, s.y + s.heightCells - 1);
      items.push({
        sortKey: maxSK + 0.5,
        draw: (ctx) => {
          const { sx, sy } = gridToScreenCenter(cCol, cRow, zoom, originX, originY);
          const depth2 = (STRUCTURE_DEPTH[s.structureId] ?? 12) * zoom;
          const sz = Math.max(14, tileH(zoom) * 0.9);
          ctx.save();
          ctx.font = `${sz}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(def.emoji, sx, sy - depth2 * 0.5);
          ctx.restore();
        },
      });
    });

    // Plants: expand area plants into per-cell items
    plants.forEach(pp => {
      const plantDef = getPlantById(pp.plantId);
      if (!plantDef) return;
      const pw = pp.areaW ?? 1;
      const ph = pp.areaH ?? 1;
      const isSelected = pp.id === selectedPlantId;
      const scale = STAGE_SCALE[pp.stage] ?? 0.9;

      for (let dr = 0; dr < ph; dr++) {
        for (let dc = 0; dc < pw; dc++) {
          const col = pp.x + dc;
          const row = pp.y + dr;
          const sk  = painterKey(col, row) + 0.8; // drawn above ground tiles
          const capturedCol = col, capturedRow = row;
          items.push({
            sortKey: sk,
            draw: (ctx) => {
              const { sx, sy } = gridToScreenCenter(capturedCol, capturedRow, zoom, originX, originY);
              const lift = tileH(zoom) * 0.18;
              const sz   = Math.max(10, tileH(zoom) * scale);

              // Shadow ellipse
              ctx.save();
              ctx.fillStyle = 'rgba(0,0,0,0.18)';
              ctx.beginPath();
              ctx.ellipse(sx, sy + tileH(zoom) * 0.28, tileW(zoom) * 0.22, tileH(zoom) * 0.1, 0, 0, Math.PI * 2);
              ctx.fill();

              // Selection glow
              if (isSelected) {
                ctx.shadowColor = 'rgba(255, 215, 0, 0.7)';
                ctx.shadowBlur  = 18 * zoom;
                ctx.fillStyle   = 'rgba(255, 215, 0, 0.12)';
                ctx.beginPath();
                ctx.arc(sx, sy - lift, tileH(zoom) * 0.55, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur  = 0;
              }

              // Emoji
              ctx.font = `${sz}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(plantDef.emoji, sx, sy - lift);
              ctx.restore();
            },
          });
        }
      }
    });

    items.sort((a, b) => a.sortKey - b.sortKey);
    return items;
  }, [structures, plants, selectedPlantId, zoom, originX, originY]);

  // ── Main canvas draw ─────────────────────────────────────────────────────────
  const drawMain = useCallback(() => {
    const canvas = mainRef.current;
    if (!canvas || canvasW < 1 || canvasH < 1) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasW, canvasH);

    // Sky gradient background
    const bg = ctx.createLinearGradient(0, 0, 0, canvasH);
    bg.addColorStop(0, '#b7d8ef');
    bg.addColorStop(1, '#dff0f8');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Ground tiles (painter order — simple row-major is fine, tiles don't overlap)
    for (let row = 0; row < gridH; row++) {
      for (let col = 0; col < gridW; col++) {
        // Checkerboard base + deterministic noise variation
        const noise = cellNoise(col, row);
        const base  = (col + row) % 2 === 0 ? SOIL_LIGHT : SOIL_DARK;
        // Slight brightness variation from noise
        const bright = 0.92 + noise * 0.16;
        const r = Math.round(parseInt(base.slice(1,3), 16) * bright);
        const g = Math.round(parseInt(base.slice(3,5), 16) * bright);
        const b = Math.round(parseInt(base.slice(5,7), 16) * bright);
        const soilColor = `rgb(${Math.min(255,r)},${Math.min(255,g)},${Math.min(255,b)})`;
        drawGroundTile(ctx, col, row, zoom, originX, originY, soilColor);
      }
    }

    // Sun overlay tints
    if (sunOverlay) {
      for (let row = 0; row < gridH; row++) {
        for (let col = 0; col < gridW; col++) {
          const exposure = getSunExposure(col, row, shadeZones);
          let tint: string | null = null;
          if      (exposure === 'full')    tint = 'rgba(255,220,0,0.10)';
          else if (exposure === 'partial') tint = 'rgba(255,190,0,0.14)';
          else if (exposure === 'shade')   tint = 'rgba(80,80,120,0.18)';
          if (tint) drawGroundTile(ctx, col, row, zoom, originX, originY, tint, 0);
        }
      }
    }

    // Draw structures + plants (already sorted by painter key)
    renderItems.forEach(item => item.draw(ctx));

  }, [canvasW, canvasH, gridW, gridH, zoom, originX, originY, sunOverlay, shadeZones, renderItems]);

  // ── Overlay canvas draw (hover highlight + ghost pending plant) ────────────
  const drawOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    if (!canvas || canvasW < 1 || canvasH < 1) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasW, canvasH);

    // Hover cell highlight
    if (hoverCell) {
      const { col, row } = hoverCell;
      // Only highlight if cell is in-bounds
      if (col >= 0 && col < gridW && row >= 0 && row < gridH) {
        const { sx, sy } = gridToScreen(col, row, zoom, originX, originY);
        const hw = tileW(zoom) / 2;
        const hh = tileH(zoom) / 2;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + hw, sy + hh);
        ctx.lineTo(sx, sy + hh * 2);
        ctx.lineTo(sx - hw, sy + hh);
        ctx.closePath();
        ctx.fillStyle = pendingPlantId ? 'rgba(100,200,100,0.22)' : 'rgba(200,220,255,0.20)';
        ctx.fill();
        ctx.strokeStyle = pendingPlantId ? 'rgba(60,180,60,0.7)' : 'rgba(100,140,240,0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }
    }

    // Ghost pending plant / structure preview
    if (hoverCell && pendingPlantId) {
      const { col, row } = hoverCell;
      if (col < 0 || col >= gridW || row < 0 || row >= gridH) return;

      ctx.save();
      ctx.globalAlpha = 0.55;

      if (!pendingIsStructure) {
        const plantDef = getPlantById(pendingPlantId);
        if (plantDef) {
          const { sx, sy } = gridToScreenCenter(col, row, zoom, originX, originY);
          const sz = Math.max(10, tileH(zoom) * 0.9);
          ctx.font = `${sz}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(plantDef.emoji, sx, sy - tileH(zoom) * 0.18);
        }
      } else {
        const def = getStructureById(pendingPlantId);
        if (def) {
          const depth   = STRUCTURE_DEPTH[pendingPlantId] ?? 12;
          const topHex  = STRUCT_TOP[pendingPlantId] ?? '#999999';
          const leftClr = shadeHex(topHex, 0.65);
          const rightClr= shadeHex(topHex, 0.80);
          for (let dr = 0; dr < def.heightCells; dr++) {
            for (let dc = 0; dc < def.widthCells; dc++) {
              drawIsoBox(ctx, col + dc, row + dr, zoom, originX, originY, topHex, leftClr, rightClr, depth);
            }
          }
          const cCol = col + Math.floor(def.widthCells / 2);
          const cRow = row + Math.floor(def.heightCells / 2);
          const { sx, sy } = gridToScreenCenter(cCol, cRow, zoom, originX, originY);
          const sz = Math.max(14, tileH(zoom) * 0.9);
          ctx.font = `${sz}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(def.emoji, sx, sy - (depth * zoom) * 0.5);
        }
      }

      ctx.restore();
    }
  }, [canvasW, canvasH, gridW, gridH, zoom, originX, originY, hoverCell, pendingPlantId, pendingIsStructure]);

  // ── Wire up effects ──────────────────────────────────────────────────────────
  useEffect(() => { drawMain(); }, [drawMain]);
  useEffect(() => { drawOverlay(); }, [drawOverlay]);

  // ── Canvas export ref ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasExportRef) return;
    canvasExportRef.current = async (scale = 1) => {
      const src = mainRef.current;
      if (!src) return null;
      const out = document.createElement('canvas');
      out.width  = canvasW * scale;
      out.height = canvasH * scale;
      const ctx = out.getContext('2d');
      if (!ctx) return null;
      ctx.scale(scale, scale);
      ctx.drawImage(src, 0, 0);
      return out.toDataURL('image/png');
    };
  }, [canvasExportRef, canvasW, canvasH, drawMain]);

  // ── Event helpers ────────────────────────────────────────────────────────────
  const clientToGrid = useCallback((clientX: number, clientY: number) => {
    const canvas = mainRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const { col: rawCol, row: rawRow } = screenToGrid(mx, my, zoom, originX, originY);
    return clampGrid(Math.round(rawCol), Math.round(rawRow), gridW, gridH);
  }, [zoom, originX, originY, gridW, gridH]);

  // ── Mouse handlers ───────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Middle button or right button = pan
    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      isPanningRef.current = true;
      panStartRef.current  = { mx: e.clientX, my: e.clientY, ox: originX, oy: originY };
      return;
    }
    if (e.button !== 0) return;

    const cell = clientToGrid(e.clientX, e.clientY);
    if (!cell) return;
    const { col, row } = cell;

    // Cancel pending on right-click already handled — just check plant/structure
    const hitPlant = plants.find(pp => {
      const pw = pp.areaW ?? 1;
      const ph = pp.areaH ?? 1;
      return col >= pp.x && col < pp.x + pw && row >= pp.y && row < pp.y + ph;
    });

    if (hitPlant) {
      onSelectPlant(hitPlant);
      if (e.detail >= 2) {
        // Double-click → start drag
        draggingIdRef.current = hitPlant.id;
        if (onMovePlantStart) onMovePlantStart(hitPlant.id);
      }
      return;
    }

    const hitStructure = structures.find(
      s => col >= s.x && col < s.x + s.widthCells && row >= s.y && row < s.y + s.heightCells,
    );
    if (hitStructure) {
      onSelectPlant(null);
      return;
    }

    // Place pending item
    if (pendingPlantId) {
      if (!pendingIsStructure) {
        onPlacePlant(pendingPlantId, col, row);
      } else {
        onPlaceStructure(pendingPlantId, col, row);
      }
    } else {
      // Deselect
      onSelectPlant(null);
    }
  }, [plants, structures, pendingPlantId, pendingIsStructure, originX, originY,
      onSelectPlant, onPlacePlant, onPlaceStructure, onMovePlantStart, clientToGrid]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Pan
    if (isPanningRef.current && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.mx;
      const dy = e.clientY - panStartRef.current.my;
      setOriginX(panStartRef.current.ox + dx);
      setOriginY(panStartRef.current.oy + dy);
      return;
    }

    // Drag plant
    if (draggingIdRef.current) {
      const cell = clientToGrid(e.clientX, e.clientY);
      if (cell) onMovePlant(draggingIdRef.current, cell.col, cell.row);
    }

    // Update hover cell
    const cell = clientToGrid(e.clientX, e.clientY);
    setHoverCell(cell);
  }, [clientToGrid, onMovePlant]);

  const handleMouseUp = useCallback(() => {
    isPanningRef.current  = false;
    panStartRef.current   = null;
    draggingIdRef.current = null;
  }, []);

  const handleMouseLeave = useCallback(() => {
    isPanningRef.current  = false;
    panStartRef.current   = null;
    draggingIdRef.current = null;
    setHoverCell(null);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = mainRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const my   = e.clientY - rect.top;

    const delta   = e.deltaY < 0 ? 1 : -1;
    const factor  = delta > 0 ? 1.12 : 1 / 1.12;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
    const scale   = newZoom / zoom;

    setZoom(newZoom);
    // Zoom toward cursor: keep point under cursor stationary
    setOriginX(mx + (originX - mx) * scale);
    setOriginY(my + (originY - my) * scale);
  }, [zoom, originX, originY]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (pendingPlantId && onCancelPending) onCancelPending();
  };

  // ── Touch support (basic: single-touch pan, pinch zoom) ────────────────────
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const lastPinchRef = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      lastPinchRef.current = null;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchRef.current = Math.hypot(dx, dy);
      lastTouchRef.current = null;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.touches.length === 1 && lastTouchRef.current) {
      const dx = e.touches[0].clientX - lastTouchRef.current.x;
      const dy = e.touches[0].clientY - lastTouchRef.current.y;
      setOriginX(ox => ox + dx);
      setOriginY(oy => oy + dy);
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2 && lastPinchRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const canvas = mainRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const mx = midX - rect.left;
        const my = midY - rect.top;
        const factor  = dist / lastPinchRef.current;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
        const scale   = newZoom / zoom;
        setZoom(newZoom);
        setOriginX(mx + (originX - mx) * scale);
        setOriginY(my + (originY - my) * scale);
      }
      lastPinchRef.current = dist;
    }
  }, [zoom, originX, originY]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0 && lastTouchRef.current) {
      // Tap (no movement): try to place
      // ...handled via onClick equivalent already for simplicity
    }
    lastTouchRef.current = null;
    lastPinchRef.current = null;
  }, []);

  // ── Controls ─────────────────────────────────────────────────────────────────
  const resetView = () => {
    const z = INITIAL_ZOOM;
    const gCX = (gridW / 2 - gridH / 2) * tileW(z) / 2;
    const gCY = (gridW / 2 + gridH / 2) * tileH(z) / 2;
    setZoom(z);
    setOriginX(canvasW / 2 - gCX);
    setOriginY(canvasH * 0.22 - gCY + gridH * tileH(z) / 2);
  };

  const controls = (
    <div className="flex gap-1 p-2 bg-slate-800/90 border-t border-slate-700 rounded-t-lg">
      <Button size="sm" variant="outline"
        onClick={() => { const nz = Math.min(MAX_ZOOM, zoom * 1.25); const s = nz/zoom; setZoom(nz); setOriginX(canvasW/2 + (originX - canvasW/2)*s); setOriginY(canvasH/2 + (originY - canvasH/2)*s); }}
        title="Zoom in">
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="outline"
        onClick={() => { const nz = Math.max(MIN_ZOOM, zoom / 1.25); const s = nz/zoom; setZoom(nz); setOriginX(canvasW/2 + (originX - canvasW/2)*s); setOriginY(canvasH/2 + (originY - canvasH/2)*s); }}
        title="Zoom out">
        <ZoomOut className="h-4 w-4" />
      </Button>
      <span className="px-2 text-xs text-slate-300 flex items-center tabular-nums">
        {Math.round(zoom * 100)}%
      </span>
      <Button size="sm" variant="outline" onClick={resetView} title="Reset view">
        <RotateCcw className="h-4 w-4" />
      </Button>
      <div className="border-l border-slate-600 mx-1" />
      <Button
        size="sm"
        variant={sunOverlay ? 'default' : 'outline'}
        onClick={() => { setSunOverlay(v => !v); onShowSunOverlayChange?.(!sunOverlay); }}
        className={sunOverlay ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : 'hover:bg-yellow-500/20'}
        title="Toggle sun overlay">
        ☀️ Sun
      </Button>
    </div>
  );

  // ── Cursor style ─────────────────────────────────────────────────────────────
  const cursor = isPanningRef.current ? 'grabbing'
    : pendingPlantId            ? 'crosshair'
    : draggingIdRef.current     ? 'grabbing'
    : 'grab';

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-sky-200 rounded-lg m-2 shadow-lg"
      >
        {/* Main scene canvas */}
        <canvas
          ref={mainRef}
          width={canvasW}
          height={canvasH}
          className="absolute inset-0 block"
          style={{ cursor, imageRendering: 'auto' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />

        {/* Overlay canvas — hover / ghost only, pointer-events disabled */}
        <canvas
          ref={overlayRef}
          width={canvasW}
          height={canvasH}
          className="absolute inset-0 block pointer-events-none"
          style={{ imageRendering: 'auto' }}
        />

        {/* Keyboard hint */}
        {pendingPlantId && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full pointer-events-none">
            Click to place · Right-click to cancel
          </div>
        )}
      </div>

      {/* Controls — portalled or inline */}
      {controlsPortalRef?.current
        ? createPortal(controls, controlsPortalRef.current)
        : controls}
    </div>
  );
};
