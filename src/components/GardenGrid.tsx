import { useRef, useState, useCallback } from 'react';
import { PlacedPlant, PlotSettings } from '@/types/garden';
import { getPlantById } from '@/data/plants';

interface GardenGridProps {
  settings: PlotSettings;
  plants: PlacedPlant[];
  onPlacePlant: (plantId: string, x: number, y: number) => void;
  onRemovePlant: (id: string) => void;
  onSelectPlant: (plant: PlacedPlant | null) => void;
  selectedPlantId: string | null;
}

export function GardenGrid({ settings, plants, onPlacePlant, onRemovePlant, onSelectPlant, selectedPlantId }: GardenGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const cellSize = settings.cellSizePx;
  const cols = Math.round(settings.widthM * (settings.unit === 'meters' ? 4 : 1.2));
  const rows = Math.round(settings.heightM * (settings.unit === 'meters' ? 4 : 1.2));
  const gridW = cols * cellSize;
  const gridH = rows * cellSize;

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
    if (!plantId) return;
    const { x, y } = snapToGrid(e.clientX, e.clientY);
    onPlacePlant(plantId, x, y);
  }, [snapToGrid, onPlacePlant]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  return (
    <div className="flex-1 overflow-auto bg-muted/30 p-4">
      <div
        ref={gridRef}
        className={`relative mx-auto garden-grid-pattern border-2 rounded-lg transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}
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
          i % 4 === 0 && (
            <span key={`col-${i}`} className="absolute -top-5 text-[10px] text-muted-foreground" style={{ left: i * cellSize }}>
              {settings.unit === 'meters' ? `${(i / 4).toFixed(0)}m` : `${(i / 1.2).toFixed(0)}ft`}
            </span>
          )
        ))}
        {Array.from({ length: rows }).map((_, i) => (
          i % 4 === 0 && (
            <span key={`row-${i}`} className="absolute -left-7 text-[10px] text-muted-foreground" style={{ top: i * cellSize }}>
              {settings.unit === 'meters' ? `${(i / 4).toFixed(0)}m` : `${(i / 1.2).toFixed(0)}ft`}
            </span>
          )
        ))}

        {/* Placed plants */}
        {plants.map(placed => {
          const plantData = getPlantById(placed.plantId);
          if (!plantData) return null;
          const isSelected = selectedPlantId === placed.id;
          return (
            <div
              key={placed.id}
              className={`absolute flex items-center justify-center cursor-pointer transition-all hover:scale-110 ${isSelected ? 'ring-2 ring-primary ring-offset-1 scale-110 z-10' : ''}`}
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
              title={`${plantData.name} (right-click to remove)`}
            >
              <span className="text-lg select-none">{plantData.emoji}</span>
            </div>
          );
        })}

        {/* Empty state */}
        {plants.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-muted-foreground text-sm bg-card/80 backdrop-blur-sm px-4 py-2 rounded-lg">
              Drag plants from the sidebar to start planning 🌱
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
