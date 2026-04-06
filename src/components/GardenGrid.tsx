import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { PlacedPlant, PlotSettings, PlacedStructure } from '@/types/garden';
import { getPlantById, plants as allPlantData } from '@/data/plants';
import { getStructureById } from '@/data/structures';
import { calculateShadeZones, getSunExposure, sunExposureColors } from '@/utils/sunCalculator';
import { X } from 'lucide-react';

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

  const cellSize = settings.cellSizePx;
  const cellsPerUnit = settings.unit === 'meters' ? (100 / settings.cellSizeCm) : (30.48 / settings.cellSizeCm);
  const cols = Math.round(settings.widthM * cellsPerUnit);
  const rows = Math.round(settings.heightM * cellsPerUnit);
  const gridW = cols * cellSize;
  const gridH = rows * cellSize;

  // Calculate shade zones
  const shadeZones = useMemo(
    () => calculateShadeZones(structures, settings, cols, rows),
    [structures, settings, cols, rows]
  );

  // Companion/enemy relationship map for each placed plant
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

  // Grid labels: show every N cells to match 1m or 1ft marks
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
    }
  }, [snapToGrid, onPlacePlant, onPlaceStructure]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

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

  // Compass rose direction
  const compassRotation = settings.southDirection;

  return (
    <div className="flex-1 overflow-auto bg-muted/30 p-4">
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
              {/* Compass circle */}
              <circle cx="24" cy="24" r="22" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1.5" />
              {/* North arrow (red) */}
              <polygon points="24,4 20,22 24,19 28,22" fill="hsl(0 70% 50%)" />
              {/* South arrow (muted) */}
              <polygon points="24,44 20,26 24,29 28,26" fill="hsl(var(--muted-foreground) / 0.4)" />
              {/* East/West lines */}
              <line x1="4" y1="24" x2="18" y2="24" stroke="hsl(var(--muted-foreground) / 0.3)" strokeWidth="1" />
              <line x1="30" y1="24" x2="44" y2="24" stroke="hsl(var(--muted-foreground) / 0.3)" strokeWidth="1" />
              {/* Center dot */}
              <circle cx="24" cy="24" r="2.5" fill="hsl(var(--foreground))" />
            </svg>
            {/* N label (stays at top of the arrow) */}
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
          {/* Sun toggle */}
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
          onDragLeave={() => setDragOver(false)}
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

          {/* Placed structures */}
          {structures.map(struct => {
            const data = getStructureById(struct.structureId);
            if (!data) return null;
            return (
              <div
                key={struct.id}
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
                {/* Resize handles */}
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
            // Sun warning: check if plant's sun preference mismatches its position
            const exposure = getSunExposure(placed.x, placed.y, shadeZones);
            const sunMismatch = plantData.sunPreference && plantData.sunPreference !== 'any' && plantData.sunPreference !== exposure;
            return (
              <div
                key={placed.id}
                className={`absolute flex items-center justify-center cursor-pointer transition-all hover:scale-110 ${isSelected ? 'ring-2 ring-primary ring-offset-1 scale-110 z-10' : 'z-[2]'}`}
                style={{
                  left: placed.x * cellSize,
                  top: placed.y * cellSize,
                  width: cellSize,
                  height: cellSize,
                }}
                onClick={e => {
                  e.stopPropagation();
                  onSelectPlant(isSelected ? null : placed);
                }}
                onContextMenu={e => {
                  e.preventDefault();
                  onRemovePlant(placed.id);
                }}
                title={`${plantData.name}${sunMismatch ? ` ⚠️ Prefers ${plantData.sunPreference}` : ''} (right-click to remove)`}
              >
                <span className="text-lg select-none">{plantData.emoji}</span>
                {sunMismatch && (
                  <span className="absolute -top-1 -right-1 text-[8px] bg-amber-500/80 text-white rounded-full w-3 h-3 flex items-center justify-center" title={`Prefers ${plantData.sunPreference}`}>
                    !
                  </span>
                )}
              </div>
            );
          })}

          {/* Empty state */}
          {plants.length === 0 && structures.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-muted-foreground text-sm bg-card/80 backdrop-blur-sm px-4 py-2 rounded-lg">
                Drag plants or structures from the sidebar to start planning 🌱
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
