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
  onFillPlantArea?: (plantId: string, x: number, y: number, w: number, h: number) => void;
}

export function GardenGrid({ settings, plants, structures, onPlacePlant, onRemovePlant, onSelectPlant, onPlaceStructure, onRemoveStructure, onResizeStructure, onMoveStructure, selectedPlantId, onFillPlantArea }: GardenGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [resizing, setResizing] = useState<{ id: string; startX: number; startY: number; startW: number; startH: number; edge: 'right' | 'bottom' | 'corner' } | null>(null);
  const [moving, setMoving] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [showSunOverlay, setShowSunOverlay] = useState(true);
  const [newlyPlacedId, setNewlyPlacedId] = useState<string | null>(null);

  // Plant resize state — drag to expand a plant into a rectangular patch
  const [plantResize, setPlantResize] = useState<{
    plantId: string; // the plant type
    originX: number; // anchor cell
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
      // Clamp to grid
      newW = Math.min(newW, cols - plantResize.originX);
      newH = Math.min(newH, rows - plantResize.originY);
      setPlantResize(prev => prev ? { ...prev, currentW: newW, currentH: newH } : null);
    };
    const handleMouseUp = () => {
      // Fill the area with plants
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

  const compassRotation = settings.southDirection;
  const showLabels = cellSize >= 28;

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
              {/* Show grid of emoji inside preview */}
              {(() => {
                const plantData = getPlantById(plantResize.plantId);
                if (!plantData) return null;
                const cells: React.ReactNode[] = [];
                for (let dy = 0; dy < plantResize.currentH; dy++) {
                  for (let dx = 0; dx < plantResize.currentW; dx++) {
                    if (dx === 0 && dy === 0) continue; // skip origin (already placed)
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

            // Growth-based sizing: days since planted
            const daysSincePlanted = placed.plantedAt
              ? Math.floor((Date.now() - new Date(placed.plantedAt).getTime()) / (1000 * 60 * 60 * 24))
              : 0;
            const daysToHarvest = plantData.daysToHarvest || 90;
            const growthPct = Math.min(1, daysSincePlanted / daysToHarvest);
            // Seedlings start bigger
            const stageBoost = placed.stage === 'seedling' ? 0.3 : 0;
            const scaleFactor = 0.55 + Math.min(0.45, (growthPct + stageBoost) * 0.45);
            const emojiSize = Math.max(cellSize * scaleFactor, 14);

            const bgColor = relations?.hasEnemy
              ? 'hsl(0 60% 95%)'
              : relations?.hasCompanion
              ? 'hsl(142 40% 93%)'
              : 'hsl(25 30% 94%)';

            // Stage indicator emoji
            const stageEmoji = placed.stage === 'seedling' ? '🌱' : '🌰';

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
                  onSelectPlant(isSelected ? null : placed);
                }}
                onContextMenu={e => {
                  e.preventDefault();
                  onRemovePlant(placed.id);
                }}
                title={`${plantData.name} (${placed.stage}, ${daysSincePlanted}d) — drag edges to fill area (right-click to remove)`}
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
                {/* Remove button */}
                <button
                  onClick={e => { e.stopPropagation(); onRemovePlant(placed.id); }}
                  className="absolute -top-1.5 -left-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  title="Remove"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
                {/* Resize handles — right edge */}
                <div
                  className="absolute top-0 -right-1 w-2 h-full cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity rounded-r"
                  style={{ background: 'hsl(var(--primary) / 0.5)' }}
                  onMouseDown={e => handlePlantResizeStart(e, placed, 'right')}
                  title="Drag to fill row"
                />
                {/* Bottom edge */}
                <div
                  className="absolute -bottom-1 left-0 w-full h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity rounded-b"
                  style={{ background: 'hsl(var(--primary) / 0.5)' }}
                  onMouseDown={e => handlePlantResizeStart(e, placed, 'bottom')}
                  title="Drag to fill column"
                />
                {/* Corner */}
                <div
                  className="absolute -bottom-1 -right-1 w-3 h-3 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity rounded-sm"
                  style={{ background: 'hsl(var(--primary) / 0.7)' }}
                  onMouseDown={e => handlePlantResizeStart(e, placed, 'corner')}
                  title="Drag to fill area"
                />
              </div>
            );
          })}

          {/* Empty state */}
          {plants.length === 0 && structures.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center bg-card/80 backdrop-blur-sm px-6 py-4 rounded-xl shadow-sm">
                <span className="text-3xl block mb-2">🌱</span>
                <p className="text-muted-foreground text-sm font-medium">Drag plants from the sidebar to start!</p>
                <p className="text-muted-foreground text-xs mt-1">Drag edges to fill rows · Right-click to remove</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
