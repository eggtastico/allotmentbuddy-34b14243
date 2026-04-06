import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { PlacedPlant, PlotSettings, PlacedStructure } from '@/types/garden';
import { getPlantById, plants as allPlantData } from '@/data/plants';
import { getStructureById } from '@/data/structures';
import { calculateShadeZones, getSunExposure, sunExposureColors } from '@/utils/sunCalculator';
import { X, Paintbrush } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface GardenGridProps {
  settings: PlotSettings;
  plants: PlacedPlant[];
  structures: PlacedStructure[];
  onPlacePlant: (plantId: string, x: number, y: number) => void;
  onRemovePlant: (id: string) => void;
  onSelectPlant: (plant: PlacedPlant | null) => void;
  onPlaceStructure: (structureId: string, x: number, y: number) => void;
  onRemoveStructure: (id: string) => void;
  onResizeStructure: (id: string, widthCells: number, heightCells: number) => void;
  onMoveStructure: (id: string, x: number, y: number) => void;
  selectedPlantId: string | null;
}

export function GardenGrid({ settings, plants, structures, onPlacePlant, onRemovePlant, onSelectPlant, onPlaceStructure, onRemoveStructure, onResizeStructure, onMoveStructure, selectedPlantId }: GardenGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [resizing, setResizing] = useState<{ id: string; startX: number; startY: number; startW: number; startH: number; edge: 'right' | 'bottom' | 'corner' } | null>(null);
  const [moving, setMoving] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [showSunOverlay, setShowSunOverlay] = useState(true);
  const [newlyPlacedId, setNewlyPlacedId] = useState<string | null>(null);

  // Paint brush state: after dropping a plant, user can click-drag to fill rows/patches
  const [brushPlantId, setBrushPlantId] = useState<string | null>(null);
  const [isPainting, setIsPainting] = useState(false);
  const paintedCellsRef = useRef<Set<string>>(new Set());

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
    const map = new Map<string, { hasCompanion: boolean; hasEnemy: boolean }>();
    const radius = 3;
    for (const p of plants) {
      const pData = getPlantById(p.plantId);
      if (!pData) continue;
      let hasCompanion = false;
      let hasEnemy = false;
      for (const other of plants) {
        if (other.id === p.id) continue;
        const dist = Math.abs(other.x - p.x) + Math.abs(other.y - p.y);
        if (dist > radius) continue;
        const oData = getPlantById(other.plantId);
        if (!oData) continue;
        if (pData.companions.includes(other.plantId) || oData.companions.includes(p.plantId)) hasCompanion = true;
        if (pData.enemies.includes(other.plantId) || oData.enemies.includes(p.plantId)) hasEnemy = true;
      }
      map.set(p.id, { hasCompanion, hasEnemy });
    }
    return map;
  }, [plants]);

  // Set of occupied cells for quick lookup
  const occupiedCells = useMemo(() => {
    const set = new Set<string>();
    for (const p of plants) set.add(`${p.x},${p.y}`);
    return set;
  }, [plants]);

  const labelInterval = settings.unit === 'meters'
    ? Math.round(100 / settings.cellSizeCm)
    : Math.round(30.48 / settings.cellSizeCm);

  const snapToGrid = useCallback((clientX: number, clientY: number) => {
    if (!gridRef.current) return { x: 0, y: 0 };
    const rect = gridRef.current.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left) / cellSize);
    const y = Math.floor((clientY - rect.top) / cellSize);
    return { x: Math.max(0, Math.min(x, cols - 1)), y: Math.max(0, Math.min(y, rows - 1)) };
  }, [cellSize, cols, rows]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const plantId = e.dataTransfer.getData('plantId');
    const structureId = e.dataTransfer.getData('structureId');
    const { x, y } = snapToGrid(e.clientX, e.clientY);
    if (structureId) {
      onPlaceStructure(structureId, x, y);
    } else if (plantId) {
      onPlacePlant(plantId, x, y);
      // Activate brush mode for this plant type
      setBrushPlantId(plantId);
    }
  }, [snapToGrid, onPlacePlant, onPlaceStructure]);

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
  }, []);

  // Paint mode: mouse down on empty cell starts painting
  const handleGridMouseDown = useCallback((e: React.MouseEvent) => {
    if (!brushPlantId || e.button !== 0) return;
    // Don't start painting if clicking on a plant or structure
    const target = e.target as HTMLElement;
    if (target.closest('[data-plant-tile]') || target.closest('[data-structure-tile]')) return;

    const { x, y } = snapToGrid(e.clientX, e.clientY);
    const key = `${x},${y}`;
    if (!occupiedCells.has(key)) {
      paintedCellsRef.current = new Set([key]);
      onPlacePlant(brushPlantId, x, y);
      setIsPainting(true);
    }
  }, [brushPlantId, snapToGrid, occupiedCells, onPlacePlant]);

  const handleGridMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPainting || !brushPlantId) return;
    const { x, y } = snapToGrid(e.clientX, e.clientY);
    const key = `${x},${y}`;
    if (!occupiedCells.has(key) && !paintedCellsRef.current.has(key)) {
      paintedCellsRef.current.add(key);
      onPlacePlant(brushPlantId, x, y);
    }
  }, [isPainting, brushPlantId, snapToGrid, occupiedCells, onPlacePlant]);

  useEffect(() => {
    if (!isPainting) return;
    const handleUp = () => {
      setIsPainting(false);
      paintedCellsRef.current.clear();
    };
    window.addEventListener('mouseup', handleUp);
    return () => window.removeEventListener('mouseup', handleUp);
  }, [isPainting]);

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

  const compassRotation = settings.southDirection;
  const showLabels = cellSize >= 28;

  const brushPlantData = brushPlantId ? getPlantById(brushPlantId) : null;

  return (
    <div className="flex-1 overflow-auto bg-muted/30 p-4">
      {/* Brush mode indicator */}
      {brushPlantId && brushPlantData && (
        <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-lg w-fit mx-auto animate-fade-in">
          <Paintbrush className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs text-foreground font-medium">
            Paint mode: {brushPlantData.emoji} {brushPlantData.name}
          </span>
          <span className="text-[10px] text-muted-foreground">— click & drag on empty cells to fill</span>
          <button
            onClick={() => setBrushPlantId(null)}
            className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground"
          >
            ✕ Clear
          </button>
        </div>
      )}

      <div className="relative mx-auto" style={{ width: gridW + 40, minHeight: gridH + 40 }}>
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
          className={`relative garden-grid-pattern border-2 rounded-lg transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border bg-card'} ${brushPlantId ? 'cursor-crosshair' : ''}`}
          style={{
            width: gridW,
            height: gridH,
            backgroundSize: `${cellSize}px ${cellSize}px`,
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={() => setDragOver(false)}
          onMouseDown={handleGridMouseDown}
          onMouseMove={handleGridMouseMove}
          onClick={(e) => {
            // Only deselect if not painting
            if (!brushPlantId) onSelectPlant(null);
          }}
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

          {/* Placed structures */}
          {structures.map(struct => {
            const data = getStructureById(struct.structureId);
            if (!data) return null;
            return (
              <div
                key={struct.id}
                data-structure-tile
                className="absolute rounded-md border-2 border-dashed flex flex-col items-center justify-center group cursor-move"
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
                {data.canGrowInside && (
                  <span className="text-[8px] text-primary font-medium">🌱 Grow inside</span>
                )}
                <button
                  onClick={e => { e.stopPropagation(); onRemoveStructure(struct.id); }}
                  className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove structure"
                >
                  <X className="h-3 w-3" />
                </button>
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
            
            const bgColor = relations?.hasEnemy
              ? 'hsl(0 60% 95%)'
              : relations?.hasCompanion
              ? 'hsl(142 40% 93%)'
              : 'hsl(25 30% 94%)';

            return (
              <div
                key={placed.id}
                data-plant-tile
                className={`absolute flex flex-col items-center justify-center cursor-pointer transition-all group
                  ${isSelected ? 'ring-2 ring-primary ring-offset-1 scale-105 z-10' : 'z-[2] hover:scale-105 hover:z-[3]'}
                  ${isNew ? 'animate-plant-pop' : ''}`}
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
                    : '0 1px 3px rgba(0,0,0,0.12)',
                  background: `var(--plant-tile-bg, ${bgColor})`,
                }}
                onClick={e => {
                  e.stopPropagation();
                  // If clicking a plant, also set it as the brush
                  setBrushPlantId(placed.plantId);
                  onSelectPlant(isSelected ? null : placed);
                }}
                onContextMenu={e => {
                  e.preventDefault();
                  onRemovePlant(placed.id);
                }}
                title={`${plantData.name}${sunMismatch ? ` ⚠️ Prefers ${plantData.sunPreference}` : ''}${relations?.hasCompanion ? ' 🟢 Companion nearby' : ''}${relations?.hasEnemy ? ' 🔴 Enemy nearby' : ''} (right-click to remove)`}
              >
                <span className="select-none leading-none" style={{ fontSize: Math.max(cellSize * 0.5, 14) }}>
                  {plantData.emoji}
                </span>
                {showLabels && (
                  <span className="text-[7px] font-medium text-foreground/70 leading-tight truncate max-w-full px-0.5 mt-0.5">
                    {plantData.name.length > 6 ? plantData.name.slice(0, 5) + '…' : plantData.name}
                  </span>
                )}
                {sunMismatch && (
                  <span className="absolute -top-1 -right-1 text-[7px] bg-amber-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold shadow-sm" title={`Prefers ${plantData.sunPreference}`}>
                    !
                  </span>
                )}
                {relations?.hasEnemy && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-destructive border border-card" title="Enemy plant nearby" />
                )}
                {relations?.hasCompanion && !relations?.hasEnemy && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border border-card" title="Companion plant nearby" />
                )}
                <button
                  onClick={e => { e.stopPropagation(); onRemovePlant(placed.id); }}
                  className="absolute -top-1.5 -left-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  title="Remove"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            );
          })}

          {/* Empty state */}
          {plants.length === 0 && structures.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center bg-card/80 backdrop-blur-sm px-6 py-4 rounded-xl shadow-sm">
                <span className="text-3xl block mb-2">🌱</span>
                <p className="text-muted-foreground text-sm font-medium">Drag plants from the sidebar to start!</p>
                <p className="text-muted-foreground text-xs mt-1">Right-click a plant to remove it</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
