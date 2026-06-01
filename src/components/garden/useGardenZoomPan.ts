/**
 * useGardenZoomPan -- manages zoom level, pan offset, keyboard navigation,
 * scroll-wheel zoom/pan, and pinch-zoom on touch devices.
 * Extracted from GardenGrid.tsx.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { PlotSettings } from '@/types/garden';

interface UseGardenZoomPanOptions {
  settings: PlotSettings;
  onSettingsChange?: (s: PlotSettings) => void;
  gridW: number;
  gridH: number;
  cols: number;
  rows: number;
  cellSize: number;
  containerRef: React.RefObject<HTMLDivElement>;
  isMobile?: boolean;
}

export function useGardenZoomPan({
  settings,
  onSettingsChange,
  gridW,
  gridH,
  cols,
  rows,
  cellSize,
  containerRef,
  isMobile,
}: UseGardenZoomPanOptions) {
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panMode, setPanMode] = useState(false);
  const touchPanRef = useRef<{ id: number; x: number; y: number; dist?: number } | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });
  const panMovedRef = useRef(false);

  const clampPan = useCallback((offset: { x: number; y: number }) => {
    const container = containerRef.current;
    if (!container) return offset;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    return {
      x: Math.min(0, Math.max(-(gridW - cw), offset.x)),
      y: Math.min(0, Math.max(-(gridH - ch), offset.y)),
    };
  }, [gridW, gridH, containerRef]);

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
    const PAN_MOVE_THRESHOLD = 8;
    let startClientX: number | null = null;
    let startClientY: number | null = null;
    const handleMouseMove = (e: MouseEvent) => {
      if (startClientX === null) { startClientX = e.clientX; startClientY = e.clientY; }
      setPanOffset(clampPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y }));
      if (!panMovedRef.current) {
        const dx = Math.abs(e.clientX - startClientX);
        const dy = Math.abs(e.clientY - (startClientY ?? 0));
        if (dx > PAN_MOVE_THRESHOLD || dy > PAN_MOVE_THRESHOLD) {
          panMovedRef.current = true;
        }
      }
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
  }, [clampPan, cellSize, settings, onSettingsChange, cols, rows, containerRef]);

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
  }, [cellSize, settings, onSettingsChange, clampPan, cols, rows, containerRef]);

  // Touch handlers for two-finger pan + pinch zoom
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const t0 = e.touches[0], t1 = e.touches[1];
      touchPanRef.current = {
        id: 0,
        x: (t0.clientX + t1.clientX) / 2,
        y: (t0.clientY + t1.clientY) / 2,
        dist: Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY),
      };
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchPanRef.current) {
      const t0 = e.touches[0], t1 = e.touches[1];
      const midX = (t0.clientX + t1.clientX) / 2;
      const midY = (t0.clientY + t1.clientY) / 2;
      const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);

      const dx = midX - touchPanRef.current.x;
      const dy = midY - touchPanRef.current.y;
      setPanOffset(prev => clampPan({ x: prev.x + dx, y: prev.y + dy }));

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
  }, [cellSize, settings, onSettingsChange, clampPan, cols, rows, containerRef]);

  const handleTouchEnd = useCallback(() => {
    touchPanRef.current = null;
  }, []);

  // Mobile single-finger pan on canvas
  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 1 || panMode) return;
    if (isMobile && e.pointerType === 'touch') {
      e.preventDefault();
      panMovedRef.current = false;
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  }, [panMode, isMobile, panOffset]);

  return {
    isPanning,
    panOffset,
    setPanOffset,
    panMode,
    setPanMode,
    panMovedRef,
    lastTapRef,
    clampPan,
    handlePanStart,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleCanvasPointerDown,
  };
}
