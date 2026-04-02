import { useState, useCallback } from 'react';
import { PlacedPlant, PlotSettings } from '@/types/garden';
import { PlantSidebar } from '@/components/PlantSidebar';
import { GardenGrid } from '@/components/GardenGrid';
import { PlantInfoPanel } from '@/components/PlantInfoPanel';
import { PlotToolbar } from '@/components/PlotToolbar';
import { Sprout } from 'lucide-react';

const Index = () => {
  const [settings, setSettings] = useState<PlotSettings>({
    widthM: 6,
    heightM: 4,
    unit: 'meters',
    cellSizePx: 32,
  });

  const [placedPlants, setPlacedPlants] = useState<PlacedPlant[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<PlacedPlant | null>(null);
  const [, setDragging] = useState<string | null>(null);

  const handlePlacePlant = useCallback((plantId: string, x: number, y: number) => {
    // Check if cell is occupied
    const occupied = placedPlants.some(p => p.x === x && p.y === y);
    if (occupied) return;

    const newPlant: PlacedPlant = {
      id: `${plantId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      plantId,
      x,
      y,
    };
    setPlacedPlants(prev => [...prev, newPlant]);
  }, [placedPlants]);

  const handleRemovePlant = useCallback((id: string) => {
    setPlacedPlants(prev => prev.filter(p => p.id !== id));
    if (selectedPlant?.id === id) setSelectedPlant(null);
  }, [selectedPlant]);

  const handleClear = useCallback(() => {
    setPlacedPlants([]);
    setSelectedPlant(null);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border bg-card px-4 flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Sprout className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-foreground text-sm leading-none">Allotment Buddy</h1>
            <p className="text-[10px] text-muted-foreground">Plan your perfect garden</p>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <PlotToolbar
        settings={settings}
        onSettingsChange={setSettings}
        plantCount={placedPlants.length}
        onClear={handleClear}
      />

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        <PlantSidebar onDragStart={setDragging} />
        <GardenGrid
          settings={settings}
          plants={placedPlants}
          onPlacePlant={handlePlacePlant}
          onRemovePlant={handleRemovePlant}
          onSelectPlant={setSelectedPlant}
          selectedPlantId={selectedPlant?.id ?? null}
        />
        {selectedPlant && (
          <PlantInfoPanel
            placed={selectedPlant}
            allPlaced={placedPlants}
            onClose={() => setSelectedPlant(null)}
            onRemove={handleRemovePlant}
          />
        )}
      </div>
    </div>
  );
};

export default Index;
