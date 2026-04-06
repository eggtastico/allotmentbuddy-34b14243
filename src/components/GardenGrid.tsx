import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { PlacedPlant, PlotSettings, PlacedStructure } from '@/types/garden';
import { getPlantById, plants as allPlantData } from '@/data/plants';
import { getStructureById } from '@/data/structures';
import { calculateShadeZones, getSunExposure, sunExposureColors } from '@/utils/sunCalculator';
import { getCompanionReason, categoryColors, categoryColorsDark } from '@/data/companionReasons';
import { X, ZoomIn, ZoomOut, Move } from 'lucide-react';
import { Input } from '@/components/ui/input';

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
  onSettingsChange?: (s: PlotSettings) => void;
  draggingPlantId?: string | null;
}

interface DragTooltip {
  x: number;
  y: number;
  plantId: string;
  gridX: number;
  gridY: number;
}

export function GardenGrid({ settings, plants, structures, onPlacePlant, onRemovePlant, onMovePlantStart, onMovePlant, onSelectPlant, onPlaceStructure, onRemoveStructure, onResizeStructure, onMoveStructure, selectedPlantId, onFillPlantArea, onSettingsChange, draggingPlantId }: GardenGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [resizing, setResizing] = useState<{ id: string; startX: number; startY: number; startW: number; startH: number; edge: 'right' | 'bottom' | 'corner' } | null>(null);
  const [moving, setMoving] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [movingPlant, setMovingPlant] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const plantMoveCommittedRef = useRef<string | null>(null);
  const [showSunOverlay, setShowSunOverlay] = useState(true);
  const [showColorCoding, setShowColorCoding] = useState(true);
  const [newlyPlacedId, setNewlyPlacedId] = useState<string | null>(null);
  const [dragTooltip, setDragTooltip] = useState<DragTooltip | null>(null);

  const [editingStructure, setEditingStructure] = useState<string | null>(null);

  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panMode, setPanMode] = useState(false);

  // Plant resize state
  const [plantResize, setPlantResize] = useState<{
    plantId: string;
    originX: number;
    originY: number;
    currentW: number;
    currentH: number;
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

  const shadeZones = useMemo(
    () => calculateShadeZones(structures, settings, cols, rows),
    [structures, settings, cols, rows]
  );

  const companionMap = useMemo(() => {
    const map = new Map<string, { hasCompanion: boolean; hasEnemy: boolean; companionNames: string[]; enemyNames: string[]; reasons: string[] }>();
    const radius = 3;
    for (const p of plants) {
      const pData = getPlantById(p.plantId);
      if (!pData) continue;
      let hasCompanion = false;
      let hasEnemy = false;
      const companionNames: string[] = [];
      const enemyNames: string[] = [];
      const reasons: string[] = [];
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
  }, [plants]);

  // Spacing conflict detection
  const spacingConflicts = useMemo(() => {
    const conflicts = new Map<string, string[]>();
    for (const p of plants) {
      const pData = getPlantById(p.plantId);
      if (!pData) continue;
      const spacingCells = Math.ceil(pData.spacingCm / settings.cellSizeCm);
      const issues: string[] = [];
      for (const other of plants) {
        if (other.id === p.id || other.plantId !== p.plantId) continue;
        const dist = Math.sqrt(Math.pow(other.x - p.x, 2) + Math.pow(other.y - p.y, 2));
        if (dist > 0 && dist < spacingCells) {
          const actualCm = Math.round(dist * settings.cellSizeCm);
          issues.push(`Too close to another ${pData.name} (${actualCm}cm, needs ${pData.spacingCm}cm)`);
        }
      }
      if (issues.length > 0) conflicts.set(p.id, issues);
    }
    return conflicts;
  }, [plants, settings.cellSizeCm]);

  const occupiedCells = useMemo(() => {
    const set = new Set<string>();
    for (const p of plants) set.add(`${p.x},${p.y}`);
    return set;
  }, [plants]);

  const labelInterval = settings.unit === 'meters'
    ? Math.round(100 / settings.cellSizeCm)
    : Math.round(30.48 / settings.cellSizeCm);

  const snapToGridFn = useCallback((clientX: number, clientY: number) => {
    if (!gridRef.current) return { x: 0, y: 0 };
    const rect = gridRef.current.getBoundingClientRect();
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
      onPlaceStructure(structureId, x, y);
    } else if (plantId) {
      onPlacePlant(plantId, x, y);
    }
  }, [snapToGridFn, onPlacePlant, onPlaceStructure]);

  useEffect(() => {
    if (plants.length > 0) {
      const newest = plants[plants.length - 1];
      setNewlyPlacedId(newest.id);
      const timer = setTimeout(() => setNewlyPlacedId(null), 400);
      return () => clearTimeout(timer);
    }
  }, [plants.length]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
    const { x, y } = snapToGridFn(e.clientX, e.clientY);
    const plantId = draggingPlantId || e.dataTransfer.getData('plantId') || '';
    setDragTooltip(plantId ? { x: e.clientX, y: e.clientY, plantId, gridX: x, gridY: y } : null);
  }, [draggingPlantId, snapToGridFn]);

  // Structure resize
  const handleResizeStart = useCallback((e: React.MouseEvent, structId: string, startW: number, startH: number, edge: 'right' | 'bottom' | 'corner') => {
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
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [resizing, cellSize, onResizeStructure]);

  // Plant resize — drag handles to expand into a patch
  const handlePlantResizeStart = useCallback((e: React.MouseEvent, placed: PlacedPlant, edge: 'right' | 'bottom' | 'corner') => {
    e.preventDefault();
    e.stopPropagation();
    setPlantResize({
      plantId: placed.plantId,
      originX: placed.x,
      originY: placed.y,
      currentW: 1,
      currentH: 1,
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
      let newW = 1;
      let newH = 1;
      if (plantResize.edge === 'right' || plantResize.edge === 'corner') newW = Math.max(1, 1 + deltaX);
      if (plantResize.edge === 'bottom' || plantResize.edge === 'corner') newH = Math.max(1, 1 + deltaY);
      newW = Math.min(newW, cols - plantResize.originX);
      newH = Math.min(newH, rows - plantResize.originY);
      setPlantResize(prev => prev ? { ...prev, currentW: newW, currentH: newH } : null);
    };
    const handleMouseUp = () => {
      if (plantResize && onFillPlantArea && (plantResize.currentW > 1 || plantResize.currentH > 1)) {
        onFillPlantArea(plantResize.plantId, plantResize.originX, plantResize.originY, plantResize.currentW, plantResize.currentH);
      }
      setPlantResize(null);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [plantResize, cellSize, cols, rows, onFillPlantArea]);

  const handleMoveStart = useCallback((e: React.MouseEvent, structId: string, origX: number, origY: number) => {
    e.preventDefault();
    e.stopPropagation();
    setMoving({ id: structId, startX: e.clientX, startY: e.clientY, origX, origY });
  }, []);

  useEffect(() => {
    if (!moving) return;
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = Math.round((e.clientX - moving.startX) / cellSize);
      const deltaY = Math.round((e.clientY - moving.startY) / cellSize);
      const newX = Math.max(0, moving.origX + deltaX);
      const newY = Math.max(0, moving.origY + deltaY);
      onMoveStructure(moving.id, newX, newY);
    };
    const handleMouseUp = () => setMoving(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [moving, cellSize, onMoveStructure]);

  const handlePlantMoveStart = useCallback((e: React.MouseEvent, plantId: string, origX: number, origY: number) => {
    if (panMode) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-no-plant-move="true"]')) return;
    e.preventDefault();
    e.stopPropagation();
    plantMoveCommittedRef.current = null;
    setMovingPlant({ id: plantId, startX: e.clientX, startY: e.clientY, origX, origY });
  }, [panMode]);

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

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [movingPlant, onMovePlant, onMovePlantStart, snapToGridFn]);

  // Panning with middle mouse or pan mode
  const handlePanStart = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || panMode) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  }, [panMode, panOffset]);

  useEffect(() => {
    if (!isPanning) return;
    const handleMouseMove = (e: MouseEvent) => {
      setPanOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    };
    const handleMouseUp = () => setIsPanning(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isPanning, panStart]);

  // Scroll wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -4 : 4;
      const newSize = Math.max(16, Math.min(64, cellSize + delta));
      if (onSettingsChange && newSize !== cellSize) {
        onSettingsChange({ ...settings, cellSizePx: newSize });
      }
    }
  }, [cellSize, settings, onSettingsChange]);

  const compassRotation = settings.southDirection;
  const showLabels = cellSize >= 28;

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  // Build spacing halo data for placed plants
  const spacingHalos = useMemo(() => {
    if (!selectedPlantId) return [];
    const selected = plants.find(p => p.id === selectedPlantId);
    if (!selected) return [];
    const pData = getPlantById(selected.plantId);
    if (!pData) return [];
    const spacingCells = Math.ceil(pData.spacingCm / settings.cellSizeCm);
    return [{ x: selected.x, y: selected.y, radius: spacingCells }];
  }, [selectedPlantId, plants, settings.cellSizeCm]);

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

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-muted/30 p-4 relative"
      onWheel={handleWheel}
      onMouseDown={handlePanStart}
      style={{ cursor: panMode ? 'grab' : 'default' }}
    >
      {/* Zoom & Pan controls */}
      <div className="absolute top-3 left-3 z-30 flex flex-col gap-1 bg-card/90 backdrop-blur-sm rounded-xl border border-border p-1 shadow-md">
        <button
          onClick={() => onSettingsChange?.({ ...settings, cellSizePx: Math.min(64, cellSize + 4) })}
          className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-foreground"
          title="Zoom in (or Ctrl+Scroll)"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <span className="text-[10px] text-center text-muted-foreground font-semibold">{cellSize}px</span>
        <button
          onClick={() => onSettingsChange?.({ ...settings, cellSizePx: Math.max(16, cellSize - 4) })}
          className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-foreground"
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <div className="h-px bg-border" />
        <button
          onClick={() => { setPanMode(m => !m); }}
          className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${panMode ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground'}`}
          title="Pan mode (middle-click also works)"
        >
          <Move className="h-4 w-4" />
        </button>
        <div className="h-px bg-border" />
        <button
          onClick={() => setShowColorCoding(c => !c)}
          className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors text-[10px] font-bold ${showColorCoding ? 'bg-primary/15 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
          title="Color-code plants by category"
        >
          🎨
        </button>
      </div>

      <div
        className="relative mx-auto transition-transform"
        style={{
          width: gridW + 40,
          minHeight: gridH + 40,
          transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
        }}
      >
        {/* Compass rose */}
        <div
          className="absolute -top-1 -right-1 z-20 flex flex-col items-center"
          title={`South is at ${settings.southDirection}°`}
        >
          <div
            className="w-12 h-12 relative"
            style={{ transform: `rotate(${compassRotation}deg)` }}
          >
            <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-md">
              <circle cx="24" cy="24" r="22" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1.5" />
              <polygon points="24,4 20,22 24,19 28,22" fill="hsl(0 70% 50%)" />
              <polygon points="24,44 20,26 24,29 28,26" fill="hsl(var(--muted-foreground) / 0.4)" />
              <line x1="4" y1="24" x2="18" y2="24" stroke="hsl(var(--muted-foreground) / 0.3)" strokeWidth="1" />
              <line x1="30" y1="24" x2="44" y2="24" stroke="hsl(var(--muted-foreground) / 0.3)" strokeWidth="1" />
              <circle cx="24" cy="24" r="2.5" fill="hsl(var(--foreground))" />
            </svg>
            <span
              className="absolute text-[8px] font-bold"
              style={{
                top: '1px',
                left: '50%',
                transform: `translateX(-50%) rotate(-${compassRotation}deg)`,
                color: 'hsl(0 70% 50%)',
              }}
            >
              N
            </span>
          </div>
          <button
            onClick={() => setShowSunOverlay(prev => !prev)}
            className={`mt-1 text-[9px] px-1.5 py-0.5 rounded font-medium transition-colors ${showSunOverlay ? 'bg-amber-500/20 text-amber-600' : 'bg-muted text-muted-foreground'}`}
            title="Toggle sun/shade overlay"
          >
            {showSunOverlay ? '☀️ Sun' : '☀️ Off'}
          </button>
        </div>

        {/* Grid */}
        <div
          ref={gridRef}
          className={`relative garden-grid-pattern border-2 rounded-lg transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}
          style={{
            width: gridW,
            height: gridH,
            backgroundSize: `${cellSize}px ${cellSize}px`,
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={() => { setDragOver(false); setDragTooltip(null); }}
          onClick={() => onSelectPlant(null)}
        >
          {/* Grid labels */}
          {Array.from({ length: cols }).map((_, i) => (
            i % labelInterval === 0 && (
              <span key={`col-${i}`} className="absolute -top-5 text-[10px] text-muted-foreground" style={{ left: i * cellSize }}>
                {settings.unit === 'meters' ? `${Math.round(i * settings.cellSizeCm / 100)}m` : `${Math.round(i * settings.cellSizeCm / 30.48)}ft`}
              </span>
            )
          ))}
          {Array.from({ length: rows }).map((_, i) => (
            i % labelInterval === 0 && (
              <span key={`row-${i}`} className="absolute -left-7 text-[10px] text-muted-foreground" style={{ top: i * cellSize }}>
                {settings.unit === 'meters' ? `${Math.round(i * settings.cellSizeCm / 100)}m` : `${Math.round(i * settings.cellSizeCm / 30.48)}ft`}
              </span>
            )
          ))}

          {/* Sun/shade overlay */}
          {showSunOverlay && shadeZones.size > 0 && Array.from(shadeZones).map(key => {
            const [sx, sy] = key.split(',').map(Number);
            const exposure = getSunExposure(sx, sy, shadeZones);
            return (
              <div
                key={`shade-${key}`}
                className="absolute pointer-events-none"
                style={{
                  left: sx * cellSize,
                  top: sy * cellSize,
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: sunExposureColors[exposure],
                }}
              />
            );
          })}

          {/* Spacing halo for selected plant */}
          {spacingHalos.map((halo, i) => (
            <div
              key={`halo-${i}`}
              className="absolute pointer-events-none rounded-full border-2 border-dashed border-primary/40 z-[1]"
              style={{
                left: (halo.x - halo.radius + 0.5) * cellSize,
                top: (halo.y - halo.radius + 0.5) * cellSize,
                width: halo.radius * 2 * cellSize,
                height: halo.radius * 2 * cellSize,
                backgroundColor: 'hsl(var(--primary) / 0.06)',
              }}
            />
          ))}

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

          {/* Plant resize preview overlay */}
          {plantResize && (plantResize.currentW > 1 || plantResize.currentH > 1) && (
            <div
              className="absolute border-2 border-dashed border-primary rounded-md pointer-events-none z-20"
              style={{
                left: plantResize.originX * cellSize,
                top: plantResize.originY * cellSize,
                width: plantResize.currentW * cellSize,
                height: plantResize.currentH * cellSize,
                backgroundColor: 'hsl(var(--primary) / 0.1)',
              }}
            >
              {(() => {
                const plantData = getPlantById(plantResize.plantId);
                if (!plantData) return null;
                const cells: React.ReactNode[] = [];
                for (let dy = 0; dy < plantResize.currentH; dy++) {
                  for (let dx = 0; dx < plantResize.currentW; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    const key = `${plantResize.originX + dx},${plantResize.originY + dy}`;
                    const isOccupied = occupiedCells.has(key);
                    cells.push(
                      <div
                        key={`preview-${dx}-${dy}`}
                        className="absolute flex items-center justify-center"
                        style={{
                          left: dx * cellSize,
                          top: dy * cellSize,
                          width: cellSize,
                          height: cellSize,
                          opacity: isOccupied ? 0.3 : 0.6,
                        }}
                      >
                        <span style={{ fontSize: Math.max(cellSize * 0.4, 12) }}>{plantData.emoji}</span>
                      </div>
                    );
                  }
                }
                return cells;
              })()}
              <span className="absolute -top-5 left-0 text-[10px] font-medium text-primary bg-card px-1 rounded">
                {plantResize.currentW}×{plantResize.currentH}
              </span>
            </div>
          )}

          {/* Placed structures */}
          {structures.map(struct => {
            const data = getStructureById(struct.structureId);
            if (!data) return null;
            return (
              <div
                key={struct.id}
                data-structure-tile
                className={`absolute border-2 border-dashed flex flex-col items-center justify-center group cursor-move ${data.shape === 'circle' ? 'rounded-full' : 'rounded-md'}`}
                style={{
                  left: struct.x * cellSize,
                  top: struct.y * cellSize,
                  width: struct.widthCells * cellSize,
                  height: struct.heightCells * cellSize,
                  backgroundColor: data.color,
                  borderColor: data.canGrowInside ? 'hsl(var(--primary) / 0.5)' : 'hsl(var(--border))',
                  zIndex: moving?.id === struct.id ? 10 : 1,
                }}
                title={`${data.name} — drag to move`}
                onMouseDown={e => handleMoveStart(e, struct.id, struct.x, struct.y)}
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
                {/* Size editor popover */}
                {editingStructure === struct.id && (
                  <div
                    className="absolute -bottom-20 left-0 z-50 bg-card border border-border rounded-lg shadow-lg p-2 flex items-center gap-2"
                    onClick={e => e.stopPropagation()}
                    onMouseDown={e => e.stopPropagation()}
                  >
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
                <div
                  className="absolute top-0 -right-1 w-2 h-full cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'hsl(var(--primary) / 0.4)' }}
                  onMouseDown={e => handleResizeStart(e, struct.id, struct.widthCells, struct.heightCells, 'right')}
                />
                <div
                  className="absolute -bottom-1 left-0 w-full h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'hsl(var(--primary) / 0.4)' }}
                  onMouseDown={e => handleResizeStart(e, struct.id, struct.widthCells, struct.heightCells, 'bottom')}
                />
                <div
                  className="absolute -bottom-1 -right-1 w-3 h-3 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity rounded-sm"
                  style={{ background: 'hsl(var(--primary) / 0.6)' }}
                  onMouseDown={e => handleResizeStart(e, struct.id, struct.widthCells, struct.heightCells, 'corner')}
                />
              </div>
            );
          })}

          {/* Placed plants */}
          {plants.map(placed => {
            const plantData = getPlantById(placed.plantId);
            if (!plantData) return null;
            const isSelected = selectedPlantId === placed.id;
            const exposure = getSunExposure(placed.x, placed.y, shadeZones);
            const sunMismatch = plantData.sunPreference && plantData.sunPreference !== 'any' && plantData.sunPreference !== exposure;
            const relations = companionMap.get(placed.id);
            const isNew = newlyPlacedId === placed.id;
            const spacingIssues = spacingConflicts.get(placed.id);

            const daysSincePlanted = placed.plantedAt
              ? Math.floor((Date.now() - new Date(placed.plantedAt).getTime()) / (1000 * 60 * 60 * 24))
              : 0;
            const daysToHarvest = plantData.daysToHarvest || 90;
            const growthPct = Math.min(1, daysSincePlanted / daysToHarvest);
            const stageBoost = placed.stage === 'seedling' ? 0.3 : 0;
            const scaleFactor = 0.55 + Math.min(0.45, (growthPct + stageBoost) * 0.45);
            const emojiSize = Math.max(cellSize * scaleFactor, 14);

            // Color coding by category
            const catColor = showColorCoding
              ? (isDark ? categoryColorsDark[plantData.category] : categoryColors[plantData.category])
              : undefined;

            const bgColor = relations?.hasEnemy
              ? 'hsl(0 60% 95%)'
              : relations?.hasCompanion
              ? 'hsl(142 40% 93%)'
              : catColor || 'hsl(25 30% 94%)';

            const stageEmoji = placed.stage === 'seedling' ? '🌱' : '🌰';

            // Build tooltip text with companion reasons
            const tooltipParts: string[] = [`${plantData.name} (${placed.stage}, ${daysSincePlanted}d)`];
            if (spacingIssues) tooltipParts.push(`⚠️ ${spacingIssues[0]}`);
            if (relations?.hasCompanion && relations.companionNames.length > 0) {
              tooltipParts.push(`✅ Good with: ${relations.companionNames.join(', ')}`);
            }
            if (relations?.hasEnemy && relations.enemyNames.length > 0) {
              tooltipParts.push(`❌ Bad with: ${relations.enemyNames.join(', ')}`);
            }
            if (relations?.reasons && relations.reasons.length > 0) {
              tooltipParts.push(`💡 ${relations.reasons[0]}`);
            }
            tooltipParts.push('Drag edges to fill area · Right-click to remove');

            return (
              <div
                key={placed.id}
                data-plant-tile
                className={`absolute flex flex-col items-center justify-center cursor-pointer transition-all group
                  ${isSelected ? 'ring-2 ring-primary ring-offset-1 scale-105 z-10' : movingPlant?.id === placed.id ? 'z-20 scale-105' : 'z-[2] hover:scale-105 hover:z-[3]'}
                  ${isNew ? 'animate-plant-pop' : ''}
                  ${spacingIssues ? 'animate-pulse' : ''}`}
                style={{
                  left: placed.x * cellSize,
                  top: placed.y * cellSize,
                  width: cellSize,
                  height: cellSize,
                  borderRadius: '6px',
                  boxShadow: relations?.hasEnemy
                    ? '0 0 8px 2px rgba(239,68,68,0.35)'
                    : relations?.hasCompanion
                    ? '0 0 8px 2px rgba(34,197,94,0.3)'
                    : spacingIssues
                    ? '0 0 8px 2px rgba(245,158,11,0.4)'
                    : '0 1px 3px rgba(0,0,0,0.12)',
                  background: `var(--plant-tile-bg, ${bgColor})`,
                }}
                onClick={e => {
                  e.stopPropagation();
                  onSelectPlant(isSelected ? null : placed);
                }}
                onMouseDown={e => handlePlantMoveStart(e, placed.id, placed.x, placed.y)}
                onContextMenu={e => {
                  e.preventDefault();
                  onRemovePlant(placed.id);
                }}
                title={tooltipParts.join('\n')}
              >
                <span className="select-none leading-none transition-all" style={{ fontSize: emojiSize }}>
                  {plantData.emoji}
                </span>
                {showLabels && (
                  <span className="text-[7px] font-medium text-foreground/70 leading-tight truncate max-w-full px-0.5 mt-0.5">
                    {plantData.name.length > 6 ? plantData.name.slice(0, 5) + '…' : plantData.name}
                  </span>
                )}
                {/* Stage badge */}
                <span className="absolute -top-1 -left-1 text-[8px] leading-none" title={placed.stage}>
                  {stageEmoji}
                </span>
                {/* Spacing warning */}
                {spacingIssues && (
                  <span className="absolute -top-2.5 -right-2.5 text-[7px] bg-amber-500 text-white rounded-md px-1 py-0.5 font-bold shadow-md z-10 whitespace-nowrap animate-pulse" title={spacingIssues[0]}>
                    ↔ Too close
                  </span>
                )}
                {!spacingIssues && sunMismatch && cellSize >= 24 && (
                  <span className="absolute -top-2.5 -right-2.5 text-[7px] bg-amber-500 text-white rounded-md px-1 py-0.5 font-bold shadow-md z-10 whitespace-nowrap" title={`Prefers ${plantData.sunPreference}`}>
                    ☀ {plantData.sunPreference?.replace('-', ' ')}
                  </span>
                )}
                {relations?.hasEnemy && (
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[7px] bg-destructive text-destructive-foreground rounded-md px-1 py-0.5 font-bold shadow-md z-10 whitespace-nowrap" title={`Enemy: ${relations.enemyNames.join(', ')}${relations.reasons.length > 0 ? ' — ' + relations.reasons[0] : ''}`}>
                    ❌ {relations.enemyNames[0]}
                  </span>
                )}
                {relations?.hasCompanion && !relations?.hasEnemy && cellSize >= 24 && (
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[7px] bg-primary text-primary-foreground rounded-md px-1 py-0.5 font-bold shadow-md z-10 whitespace-nowrap" title={`Companion: ${relations.companionNames.join(', ')}${relations.reasons.length > 0 ? ' — ' + relations.reasons[0] : ''}`}>
                    ✅ {relations.companionNames[0]}
                  </span>
                )}
                {/* Remove button */}
                <button
                  onClick={e => { e.stopPropagation(); onRemovePlant(placed.id); }}
                  data-no-plant-move="true"
                  className="absolute -top-1.5 -left-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  title="Remove"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
                {/* Resize handles */}
                <div
                  data-no-plant-move="true"
                  className="absolute top-0 -right-1 w-2 h-full cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity rounded-r"
                  style={{ background: 'hsl(var(--primary) / 0.5)' }}
                  onMouseDown={e => handlePlantResizeStart(e, placed, 'right')}
                  title="Drag to fill row"
                />
                <div
                  data-no-plant-move="true"
                  className="absolute -bottom-1 left-0 w-full h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity rounded-b"
                  style={{ background: 'hsl(var(--primary) / 0.5)' }}
                  onMouseDown={e => handlePlantResizeStart(e, placed, 'bottom')}
                  title="Drag to fill column"
                />
                <div
                  data-no-plant-move="true"
                  className="absolute -bottom-1 -right-1 w-3 h-3 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity rounded-sm"
                  style={{ background: 'hsl(var(--primary) / 0.7)' }}
                  onMouseDown={e => handlePlantResizeStart(e, placed, 'corner')}
                  title="Drag to fill area"
                />
              </div>
            );
          })}

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

          {/* Empty state */}
          {plants.length === 0 && structures.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center bg-card/80 backdrop-blur-sm px-6 py-4 rounded-xl shadow-sm">
                <span className="text-3xl block mb-2">🌱</span>
                <p className="text-muted-foreground text-sm font-medium">Drag plants from the sidebar to start!</p>
                <p className="text-muted-foreground text-xs mt-1">Drag edges to fill rows · Right-click to remove · Ctrl+Scroll to zoom</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
