import { useRef, useEffect, RefObject, useCallback, useState } from 'react';
import { PlacedPlant, PlacedStructure, PlotSettings } from '@/types/garden';
import { getPlantById } from '@/data/plants';
import { getStructureById } from '@/data/structures';
import { getSunExposure } from '@/utils/sunCalculator';

const MINIMAP_MAX = 150;

// Canvas-safe colours matching categoryColors in companionReasons.ts
const CATEGORY_COLORS: Record<string, string> = {
  vegetable: '#86efac', // green-300
  fruit: '#fda4af',     // rose-300
  herb: '#6ee7b7',      // emerald-300
  flower: '#fde68a',    // amber-200
};

const SHADE_COLORS: Record<string, string> = {
  'full-sun': 'rgba(255, 200, 50, 0.18)',
  'partial-shade': 'rgba(100, 150, 220, 0.18)',
  'full-shade': 'rgba(80, 90, 130, 0.28)',
};

interface GardenMinimapProps {
  plants: PlacedPlant[];
  structures: PlacedStructure[];
  shadeZones: Set<string>;
  settings: PlotSettings;
  cols: number;
  rows: number;
  panOffset: { x: number; y: number };
  containerRef: RefObject<HTMLDivElement>;
  showSunOverlay: boolean;
  onNavigate: (pan: { x: number; y: number }) => void;
  /** When true, renders inline (no absolute positioning) for embedding in the sidebar. */
  sidebarMode?: boolean;
}

export function GardenMinimap({
  plants,
  structures,
  shadeZones,
  settings,
  cols,
  rows,
  panOffset,
  containerRef,
  showSunOverlay,
  onNavigate,
  sidebarMode = false,
}: GardenMinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);
  const [collapsed, setCollapsed] = useState(false);

  const cellSize = settings.cellSizePx;
  const gridW = cols * cellSize;
  const gridH = rows * cellSize;
  const scale = Math.min(MINIMAP_MAX / gridW, MINIMAP_MAX / gridH, 1);
  const mmW = Math.ceil(gridW * scale);
  const mmH = Math.ceil(gridH * scale);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = mmW;
    canvas.height = mmH;

    // Soil background
    ctx.fillStyle = '#e6d5b8';
    ctx.fillRect(0, 0, mmW, mmH);

    // Sun/shade overlay
    if (showSunOverlay && shadeZones.size > 0) {
      for (const key of shadeZones) {
        const [sx, sy] = key.split(',').map(Number);
        const exposure = getSunExposure(sx, sy, shadeZones);
        ctx.fillStyle = SHADE_COLORS[exposure] ?? 'transparent';
        ctx.fillRect(
          Math.round(sx * cellSize * scale),
          Math.round(sy * cellSize * scale),
          Math.ceil(cellSize * scale),
          Math.ceil(cellSize * scale)
        );
      }
    }

    // Structures as filled rectangles
    for (const struct of structures) {
      const data = getStructureById(struct.structureId);
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = data?.color ?? '#9ca3af';
      ctx.fillRect(
        Math.round(struct.x * cellSize * scale),
        Math.round(struct.y * cellSize * scale),
        Math.ceil(struct.widthCells * cellSize * scale),
        Math.ceil(struct.heightCells * cellSize * scale)
      );
      ctx.globalAlpha = 1;
    }

    // Density heatmap overlay (4×4 cell buckets)
    const bucketSize = 4;
    const bucketCols = Math.ceil(cols / bucketSize);
    const bucketRows = Math.ceil(rows / bucketSize);
    const buckets = new Uint16Array(bucketCols * bucketRows);
    for (const plant of plants) {
      const bx = Math.min(Math.floor(plant.x / bucketSize), bucketCols - 1);
      const by = Math.min(Math.floor(plant.y / bucketSize), bucketRows - 1);
      buckets[by * bucketCols + bx]++;
    }
    let maxDensity = 0;
    for (let i = 0; i < buckets.length; i++) {
      if (buckets[i] > maxDensity) maxDensity = buckets[i];
    }
    if (maxDensity >= 3) {
      for (let by = 0; by < bucketRows; by++) {
        for (let bx = 0; bx < bucketCols; bx++) {
          const count = buckets[by * bucketCols + bx];
          if (count < 3) continue;
          // Normalize: 3 plants = coolest (green), maxDensity = hottest (red)
          const t = Math.min((count - 3) / Math.max(maxDensity - 3, 1), 1);
          // Interpolate green(120,200,80) → yellow(220,200,50) → red(220,60,40)
          let r: number, g: number, b: number;
          if (t < 0.5) {
            const s = t * 2; // 0..1 within green→yellow
            r = Math.round(120 + (220 - 120) * s);
            g = 200;
            b = Math.round(80 + (50 - 80) * s);
          } else {
            const s = (t - 0.5) * 2; // 0..1 within yellow→red
            r = 220;
            g = Math.round(200 + (60 - 200) * s);
            b = Math.round(50 + (40 - 50) * s);
          }
          // Opacity ramps from 0.25 (at threshold) to 0.4 (at max)
          const alpha = 0.25 + 0.15 * t;
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
          const px = Math.round(bx * bucketSize * cellSize * scale);
          const py = Math.round(by * bucketSize * cellSize * scale);
          const pw = Math.ceil(bucketSize * cellSize * scale);
          const ph = Math.ceil(bucketSize * cellSize * scale);
          ctx.fillRect(px, py, pw, ph);
        }
      }
    }

    // Plants as small coloured dots
    const dotR = Math.max(cellSize * scale * 0.38, 1.5);
    for (const plant of plants) {
      const pData = getPlantById(plant.plantId);
      ctx.fillStyle = pData ? (CATEGORY_COLORS[pData.category] ?? '#d1fae5') : '#d1fae5';
      ctx.beginPath();
      ctx.arc(
        (plant.x + 0.5) * cellSize * scale,
        (plant.y + 0.5) * cellSize * scale,
        dotR,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // Viewport indicator rectangle
    const cw = containerRef.current?.clientWidth ?? gridW;
    const ch = containerRef.current?.clientHeight ?? gridH;
    const vpX = Math.round(Math.max(0, -panOffset.x) * scale);
    const vpY = Math.round(Math.max(0, -panOffset.y) * scale);
    const vpW = Math.round(Math.min(cw, gridW) * scale);
    const vpH = Math.round(Math.min(ch, gridH) * scale);

    // Dim area outside viewport
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    // Top strip
    if (vpY > 0) ctx.fillRect(0, 0, mmW, vpY);
    // Bottom strip
    if (vpY + vpH < mmH) ctx.fillRect(0, vpY + vpH, mmW, mmH - (vpY + vpH));
    // Left strip
    if (vpX > 0) ctx.fillRect(0, vpY, vpX, vpH);
    // Right strip
    if (vpX + vpW < mmW) ctx.fillRect(vpX + vpW, vpY, mmW - (vpX + vpW), vpH);

    // Viewport border
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.strokeRect(vpX + 0.75, vpY + 0.75, vpW - 1.5, vpH - 1.5);
  }, [mmW, mmH, plants, structures, shadeZones, panOffset, containerRef, scale, cellSize, gridW, gridH, showSunOverlay, cols, rows]);

  // Convert a minimap canvas coordinate to the pan offset that centres the
  // viewport on that garden point.
  const minimapToPan = useCallback((mx: number, my: number) => {
    const cw = containerRef.current?.clientWidth ?? 0;
    const ch = containerRef.current?.clientHeight ?? 0;
    return {
      x: cw / 2 - mx / scale,
      y: ch / 2 - my / scale,
    };
  }, [containerRef, scale]);

  const getCanvasPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    isDragging.current = true;
    canvasRef.current?.setPointerCapture(e.pointerId);
    const { x, y } = getCanvasPos(e);
    onNavigate(minimapToPan(x, y));
  }, [minimapToPan, onNavigate]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const { x, y } = getCanvasPos(e);
    onNavigate(minimapToPan(x, y));
  }, [minimapToPan, onNavigate]);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Don't render if the garden fits entirely on-screen (no point panning)
  if (scale >= 1) return null;

  if (sidebarMode) {
    return (
      <div className="rounded border border-border/60 overflow-hidden select-none" title="Click or drag to navigate">
        <button
          onClick={() => setCollapsed(c => !c)}
          className="bg-card/90 border-b border-border/40 text-center w-full hover:bg-muted/60 transition-colors"
          style={{ fontSize: 8, padding: '1px 4px', color: 'hsl(var(--muted-foreground))' }}
        >
          overview {collapsed ? '▸' : '▾'}
        </button>
        {!collapsed && (
          <div style={{ display: 'flex', justifyContent: 'center', backgroundColor: '#e6d5b8' }}>
            <canvas
              ref={canvasRef}
              style={{ display: 'block', cursor: 'crosshair' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="absolute rounded border border-border/60 shadow-lg overflow-hidden select-none"
      style={{ bottom: 10, right: 10, zIndex: 35 }}
      title="Click or drag to navigate"
    >
      <button
        onClick={() => setCollapsed(c => !c)}
        className="bg-card/90 border-b border-border/40 text-center w-full hover:bg-muted/60 transition-colors"
        style={{ fontSize: 8, padding: '1px 4px', color: 'hsl(var(--muted-foreground))' }}
      >
        overview {collapsed ? '▸' : '▾'}
      </button>
      {!collapsed && (
        <canvas
          ref={canvasRef}
          style={{ display: 'block', cursor: 'crosshair' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      )}
    </div>
  );
}
