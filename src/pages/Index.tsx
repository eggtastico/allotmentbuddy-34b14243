import { useState, useCallback } from 'react';
import { PlacedPlant, PlotSettings, PlacedStructure } from '@/types/garden';
import { PlantSidebar } from '@/components/PlantSidebar';
import { GardenGrid } from '@/components/GardenGrid';
import { PlantInfoPanel } from '@/components/PlantInfoPanel';
import { getStructureById } from '@/data/structures';
import { PlotToolbar } from '@/components/PlotToolbar';
import { PlantingCalendar } from '@/components/PlantingCalendar';
import { AIChat } from '@/components/AIChat';
import { AuthModal } from '@/components/AuthModal';
import { SaveLoadPanel } from '@/components/SaveLoadPanel';
import { RotationPanel } from '@/components/RotationPanel';
import { WeatherYieldPanel } from '@/components/WeatherYieldPanel';
import { WateringGuide } from '@/components/WateringGuide';
import { useAuth } from '@/hooks/useAuth';
import { exportGardenPDF } from '@/utils/exportPDF';
import { optimizeRotation } from '@/utils/rotationOptimizer';
import { Sprout, Calendar, Bot, Download, FolderOpen, User, LogOut, Shuffle, CloudSun, Droplets } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const Index = () => {
  const { user, signOut, loading: authLoading } = useAuth();

  const [settings, setSettings] = useState<PlotSettings>({
    widthM: 6, heightM: 4, unit: 'meters', cellSizePx: 32,
  });
  const [placedPlants, setPlacedPlants] = useState<PlacedPlant[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<PlacedPlant | null>(null);
  const [placedStructures, setPlacedStructures] = useState<PlacedStructure[]>([]);
  const [, setDragging] = useState<string | null>(null);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [planName, setPlanName] = useState('My Garden');

  // Modals
  const [showCalendar, setShowCalendar] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showSaveLoad, setShowSaveLoad] = useState(false);
  const [showRotation, setShowRotation] = useState(false);
  const [showWeather, setShowWeather] = useState(false);
  const [showWatering, setShowWatering] = useState(false);

  const handlePlacePlant = useCallback((plantId: string, x: number, y: number) => {
    const occupied = placedPlants.some(p => p.x === x && p.y === y);
    if (occupied) return;
    setPlacedPlants(prev => [...prev, {
      id: `${plantId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      plantId, x, y,
    }]);
  }, [placedPlants]);

  const handleRemovePlant = useCallback((id: string) => {
    setPlacedPlants(prev => prev.filter(p => p.id !== id));
    if (selectedPlant?.id === id) setSelectedPlant(null);
  }, [selectedPlant]);

  const handlePlaceStructure = useCallback((structureId: string, x: number, y: number) => {
    const structData = getStructureById(structureId);
    if (!structData) return;
    setPlacedStructures(prev => [...prev, {
      id: `${structureId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      structureId,
      x,
      y,
      widthCells: structData.widthCells,
      heightCells: structData.heightCells,
    }]);
  }, []);

  const handleRemoveStructure = useCallback((id: string) => {
    setPlacedStructures(prev => prev.filter(s => s.id !== id));
  }, []);

  const handleResizeStructure = useCallback((id: string, widthCells: number, heightCells: number) => {
    setPlacedStructures(prev => prev.map(s => s.id === id ? { ...s, widthCells, heightCells } : s));
  }, []);

  const handleMoveStructure = useCallback((id: string, x: number, y: number) => {
    setPlacedStructures(prev => prev.map(s => s.id === id ? { ...s, x, y } : s));
  }, []);

  const handleClear = useCallback(() => {
    setPlacedPlants([]);
    setPlacedStructures([]);
    setSelectedPlant(null);
  }, []);

  const handleLoadPlan = useCallback((plan: any) => {
    setCurrentPlanId(plan.id);
    setPlanName(plan.name);
    setSettings(plan.plot_settings as PlotSettings);
    setPlacedPlants((plan.plants as PlacedPlant[]) || []);
    setSelectedPlant(null);
    toast.success(`Loaded "${plan.name}" 🌿`);
  }, []);

  const handleNewPlan = useCallback(() => {
    setCurrentPlanId(null);
    setPlanName('My Garden');
    setSettings({ widthM: 6, heightM: 4, unit: 'meters', cellSizePx: 32 });
    setPlacedPlants([]);
    setSelectedPlant(null);
  }, []);

  const handleExportPDF = async () => {
    try {
      await exportGardenPDF(settings, placedPlants, planName);
      toast.success('PDF exported! 📄');
    } catch (err) {
      toast.error('Failed to export PDF');
    }
  };
  const handleOptimizeRotation = useCallback(() => {
    const cols = Math.round(settings.widthM * (settings.unit === 'meters' ? 4 : 1.2));
    const rows = Math.round(settings.heightM * (settings.unit === 'meters' ? 4 : 1.2));
    const optimized = optimizeRotation(placedPlants, cols, rows);
    setPlacedPlants(optimized);
    setSelectedPlant(null);
    toast.success('Garden rotation optimized! 🔄');
  }, [placedPlants, settings]);


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

        <div className="flex items-center gap-1 ml-auto">
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setShowCalendar(true)}>
            <Calendar className="h-3.5 w-3.5 mr-1" /> Calendar
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setShowAI(true)}>
            <Bot className="h-3.5 w-3.5 mr-1" /> AI Help
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setShowRotation(true)}>
            <Shuffle className="h-3.5 w-3.5 mr-1" /> Rotation
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setShowWeather(true)}>
            <CloudSun className="h-3.5 w-3.5 mr-1" /> Weather
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setShowWatering(true)}>
            <Droplets className="h-3.5 w-3.5 mr-1" /> Watering
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={handleExportPDF}>
            <Download className="h-3.5 w-3.5 mr-1" /> PDF
          </Button>
          {user ? (
            <>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setShowSaveLoad(true)}>
                <FolderOpen className="h-3.5 w-3.5 mr-1" /> My Gardens
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => signOut()}>
                <LogOut className="h-3.5 w-3.5 mr-1" /> Sign Out
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowAuth(true)}>
              <User className="h-3.5 w-3.5 mr-1" /> Sign In
            </Button>
          )}
        </div>
      </header>

      {/* Toolbar */}
      <PlotToolbar settings={settings} onSettingsChange={setSettings} plantCount={placedPlants.length} onClear={handleClear} />

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        <PlantSidebar onDragStart={setDragging} />
        <GardenGrid
          settings={settings}
          plants={placedPlants}
          structures={placedStructures}
          onPlacePlant={handlePlacePlant}
          onRemovePlant={handleRemovePlant}
          onSelectPlant={setSelectedPlant}
          onPlaceStructure={handlePlaceStructure}
          onRemoveStructure={handleRemoveStructure}
          onResizeStructure={handleResizeStructure}
          onMoveStructure={handleMoveStructure}
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

      {/* Modals */}
      {showCalendar && <PlantingCalendar placedPlants={placedPlants} onClose={() => setShowCalendar(false)} />}
      {showAI && <AIChat settings={settings} plants={placedPlants} onClose={() => setShowAI(false)} />}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showSaveLoad && user && (
        <SaveLoadPanel
          currentPlanId={currentPlanId}
          currentName={planName}
          settings={settings}
          plants={placedPlants}
          beds={[]}
          onLoad={handleLoadPlan}
          onNewPlan={handleNewPlan}
          onClose={() => setShowSaveLoad(false)}
        />
      )}
      {showWeather && (
        <WeatherYieldPanel plants={placedPlants} onClose={() => setShowWeather(false)} />
      )}
      {showRotation && (
        <RotationPanel
          plants={placedPlants}
          onOptimize={handleOptimizeRotation}
          onClose={() => setShowRotation(false)}
        />
      )}
    </div>
  );
};

export default Index;
