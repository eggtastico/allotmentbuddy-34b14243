/**
 * useGardenDrag -- handles drag-and-drop, structure move/resize, plant move,
 * plant resize (fill area), and long-press to move on mobile.
 * Extracted from GardenGrid.tsx.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { PlacedPlant, PlacedStructure } from '@/types/garden';

interface UseGardenDragOptions {
  cellSize: number;
  cols: number;
  rows: number;
  structures: PlacedStructure[];
  locked: boolean;
  isMobile?: boolean;
  panMode: boolean;
  propStructureMode?: boolean;
  onResizeStructure: (id: string, widthCells: number, heightCells: number) => void;
  onMoveStructure: (id: string, x: number, y: number) => void;
  onMoveStructureStart?: () => void;
  onMovePlant: (id: string, x: number, y: number) => void;
  onMovePlantStart?: (id: string) => void;
  onRemovePlant: (id: string) => void;
  onFillPlantArea?: (plantId: string, x: number, y: number, w: number, h: number) => void;
  snapToGridFn: (clientX: number, clientY: number) => { x: number; y: number };
}

export function useGardenDrag({
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
}: UseGardenDragOptions) {
  // Structure resize state
  const [resizing, setResizing] = useState<{ id: string; startX: number; startY: number; startW: number; startH: number; edge: 'right' | 'bottom' | 'corner' } | null>(null);
  // Structure move state
  const [moving, setMoving] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [movePending, setMovePending] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  // Plant move state
  const [movingPlant, setMovingPlant] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const plantMoveCommittedRef = useRef<string | null>(null);
  // Long-press to initiate plant move
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressPendingRef = useRef<{ id: string; origX: number; origY: number; startX: number; startY: number } | null>(null);
  const [longPressPlantId, setLongPressPlantId] = useState<string | null>(null);
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

  // Long-press constants
  const LONG_PRESS_DELAY_MS = 450;
  const LONG_PRESS_MOVE_THRESHOLD_PX = 10;

  // ── Structure resize ──
  const handleResizeStart = useCallback((e: React.PointerEvent, structId: string, startW: number, startH: number, edge: 'right' | 'bottom' | 'corner') => {
    if (locked) return;
    e.preventDefault();
    e.stopPropagation();
    setResizing({ id: structId, startX: e.clientX, startY: e.clientY, startW, startH, edge });
  }, [locked]);

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

  // ── Plant resize ──
  const handlePlantResizeStart = useCallback((e: React.PointerEvent, placed: PlacedPlant, edge: 'right' | 'bottom' | 'corner') => {
    if (locked) return;
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
  }, [locked]);

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

  // ── Structure move ──
  const handleMoveStart = useCallback((e: React.PointerEvent, structId: string, origX: number, origY: number) => {
    if (locked) { e.stopPropagation(); return; }
    e.preventDefault();
    e.stopPropagation();
    setMovePending({ id: structId, startX: e.clientX, startY: e.clientY, origX, origY });
  }, [locked]);

  useEffect(() => {
    if (!moving && !movePending) return;
    const DRAG_THRESHOLD = isMobile ? 14 : 5;

    const handleMouseMove = (e: MouseEvent) => {
      if (movePending && !moving) {
        const dist = Math.hypot(e.clientX - movePending.startX, e.clientY - movePending.startY);
        if (dist >= DRAG_THRESHOLD) {
          onMoveStructureStart?.();
          setMoving(movePending);
          setMovePending(null);
        }
        return;
      }
      if (!moving) return;
      const deltaX = Math.round((e.clientX - moving.startX) / cellSize);
      const deltaY = Math.round((e.clientY - moving.startY) / cellSize);
      const struct = structures.find(s => s.id === moving.id);
      const w = struct?.widthCells ?? 1;
      const h = struct?.heightCells ?? 1;
      const newX = Math.max(0, Math.min(Math.round(moving.origX + deltaX), cols - w));
      const newY = Math.max(0, Math.min(Math.round(moving.origY + deltaY), rows - h));
      onMoveStructure(moving.id, newX, newY);
    };
    const handleMouseUp = () => { setMoving(null); setMovePending(null); };
    window.addEventListener('pointermove', handleMouseMove);
    window.addEventListener('pointerup', handleMouseUp);
    return () => { window.removeEventListener('pointermove', handleMouseMove); window.removeEventListener('pointerup', handleMouseUp); };
  }, [moving, movePending, cellSize, onMoveStructure, onMoveStructureStart, structures, cols, rows, isMobile]);

  // ── Plant move (pointer drag) ──
  const handlePlantMoveStart = useCallback((e: React.PointerEvent, plantId: string, origX: number, origY: number) => {
    if (panMode || locked) return;
    if (propStructureMode) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-no-plant-move="true"]')) return;
    e.preventDefault();
    e.stopPropagation();
    plantMoveCommittedRef.current = null;
    setMovingPlant({ id: plantId, startX: e.clientX, startY: e.clientY, origX, origY });
  }, [panMode, propStructureMode, locked]);

  // ── Long-press ──
  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressPendingRef.current = null;
    setLongPressPlantId(null);
  }, []);

  const startLongPress = useCallback((e: React.PointerEvent, plant: PlacedPlant) => {
    if (panMode || propStructureMode || locked) return;
    e.preventDefault();
    e.stopPropagation();
    cancelLongPress();
    longPressPendingRef.current = { id: plant.id, origX: plant.x, origY: plant.y, startX: e.clientX, startY: e.clientY };
    setLongPressPlantId(plant.id);
    longPressTimerRef.current = setTimeout(() => {
      const pending = longPressPendingRef.current;
      if (!pending) return;
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(40); } catch { /* ignore */ }
      }
      plantMoveCommittedRef.current = null;
      setMovingPlant({ id: pending.id, startX: pending.startX, startY: pending.startY, origX: pending.origX, origY: pending.origY });
      setLongPressPlantId(null);
      longPressPendingRef.current = null;
      longPressTimerRef.current = null;
    }, LONG_PRESS_DELAY_MS);
  }, [panMode, propStructureMode, locked, cancelLongPress]);

  // Cancel long press if pointer released or moved too far
  useEffect(() => {
    if (!longPressPlantId) return;
    const onCancel = () => cancelLongPress();
    const onMove = (e: PointerEvent) => {
      const pending = longPressPendingRef.current;
      if (!pending) return;
      const dist = Math.hypot(e.clientX - pending.startX, e.clientY - pending.startY);
      if (dist > LONG_PRESS_MOVE_THRESHOLD_PX) cancelLongPress();
    };
    window.addEventListener('pointerup', onCancel);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointerup', onCancel);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('pointermove', onMove);
    };
  }, [longPressPlantId, cancelLongPress]);

  // Plant move effect
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

  return {
    // Structure
    resizing,
    moving,
    handleResizeStart,
    handleMoveStart,
    // Plant move
    movingPlant,
    handlePlantMoveStart,
    // Long-press
    longPressPlantId,
    startLongPress,
    cancelLongPress,
    LONG_PRESS_DELAY_MS,
    // Plant resize
    plantResize,
    handlePlantResizeStart,
  };
}
