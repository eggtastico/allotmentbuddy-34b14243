import { useState, useCallback, useMemo } from 'react';
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
import { WelcomeModal } from '@/components/WelcomeModal';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { LocationPicker } from '@/components/LocationPicker';
import { useAuth } from '@/hooks/useAuth';
import { exportGardenPDF } from '@/utils/exportPDF';
import { optimizeRotation } from '@/utils/rotationOptimizer';
import { calculateShadeZones, getSunExposure } from '@/utils/sunCalculator';
import { Sprout, Calendar, Bot, Download, FolderOpen, User, LogOut, Shuffle, CloudSun, Droplets, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface LocationData {
  name: string;
  lat: number;
  lon: number;
  region?: string;
}

const Index = () => {
  const { user, signOut, loading: authLoading } = useAuth();

  const [settings, setSettings] = useState<PlotSettings>({
    widthM: 6, heightM: 4, unit: 'meters', cellSizePx: 32, cellSizeCm: 20, southDirection: 180,
  });
  const [placedPlants, setPlacedPlants] = useState<PlacedPlant[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<PlacedPlant | null>(null);
  const [placedStructures, setPlacedStructures] = useState<PlacedStructure[]>([]);
  const [, setDragging] = useState<string | null>(null);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [planName, setPlanName] = useState('My Garden');
  const [location, setLocation] = useState<LocationData | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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

  const handleFillPlantArea = useCallback((plantId: string, originX: number, originY: number, w: number, h: number) => {
    setPlacedPlants(prev => {
      const occupied = new Set(prev.map(p => `${p.x},${p.y}`));
      const newPlants: PlacedPlant[] = [];
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          const key = `${originX + dx},${originY + dy}`;
          if (!occupied.has(key)) {
            newPlants.push({
              id: `${plantId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${dx}-${dy}`,
              plantId, x: originX + dx, y: originY + dy,
            });
            occupied.add(key);
          }
        }
      }
      return [...prev, ...newPlants];
    });
  }, []);

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
      x, y,
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
    setSettings({ widthM: 6, heightM: 4, unit: 'meters', cellSizePx: 32, cellSizeCm: 20, southDirection: 180 });
    setPlacedPlants([]);
    setSelectedPlant(null);
  }, []);

  const handleExportPDF = async () => {
    try {
      await exportGardenPDF(settings, placedPlants, planName);
      toast.success('PDF exported! 📄');
    } catch {
      toast.error('Failed to export PDF');
    }
  };

  const handleOptimizeRotation = useCallback(() => {
    const cellsPerUnit = settings.unit === 'meters' ? (100 / settings.cellSizeCm) : (30.48 / settings.cellSizeCm);
    const optimizedCols = Math.round(settings.widthM * cellsPerUnit);
    const optimizedRows = Math.round(settings.heightM * cellsPerUnit);
    const optimized = optimizeRotation(placedPlants, optimizedCols, optimizedRows);
    setPlacedPlants(optimized);
    setSelectedPlant(null);
    toast.success('Garden rotation optimized! 🔄');
  }, [placedPlants, settings]);

  const navButtons = (
    <>
      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setShowCalendar(true); setMobileMenuOpen(false); }}>
        <Calendar className="h-3.5 w-3.5 mr-1" /> Calendar
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setShowAI(true); setMobileMenuOpen(false); }}>
        <Bot className="h-3.5 w-3.5 mr-1" /> AI Help
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setShowRotation(true); setMobileMenuOpen(false); }}>
        <Shuffle className="h-3.5 w-3.5 mr-1" /> Rotation
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setShowWeather(true); setMobileMenuOpen(false); }}>
        <CloudSun className="h-3.5 w-3.5 mr-1" /> Weather
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setShowWatering(true); setMobileMenuOpen(false); }}>
        <Droplets className="h-3.5 w-3.5 mr-1" /> Watering
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { handleExportPDF(); setMobileMenuOpen(false); }}>
        <Download className="h-3.5 w-3.5 mr-1" /> PDF
      </Button>
      {user ? (
        <>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setShowSaveLoad(true); setMobileMenuOpen(false); }}>
            <FolderOpen className="h-3.5 w-3.5 mr-1" /> My Gardens
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => signOut()}>
            <LogOut className="h-3.5 w-3.5 mr-1" /> Sign Out
          </Button>
        </>
      ) : (
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setShowAuth(true); setMobileMenuOpen(false); }}>
          <User className="h-3.5 w-3.5 mr-1" /> Sign In
        </Button>
      )}
    </>
  );

  return (
    <div className="h-screen flex flex-col bg-background">
      <WelcomeModal />

      {/* Header */}
      <header className="h-14 border-b border-border bg-card px-4 flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Sprout className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-bold text-foreground text-sm leading-none">Allotment Buddy</h1>
            <p className="text-[10px] text-muted-foreground">Plan your perfect garden</p>
          </div>
        </div>

        <LocationPicker location={location} onLocationChange={setLocation} />

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-1 ml-auto">
          {navButtons}
          <div className="h-5 w-px bg-border mx-1" />
          <DarkModeToggle />
        </div>

        {/* Mobile nav */}
        <div className="lg:hidden flex items-center gap-1 ml-auto">
          <DarkModeToggle />
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:hidden" onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}>
            <Sprout className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-border bg-card px-4 py-2 flex flex-wrap gap-1 animate-fade-in">
          {navButtons}
        </div>
      )}

      {/* Toolbar */}
      <PlotToolbar settings={settings} onSettingsChange={setSettings} plantCount={placedPlants.length} onClear={handleClear} />

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar — hidden on mobile unless toggled */}
        <div className={`${mobileSidebarOpen ? 'absolute inset-y-0 left-0 z-30 w-72 shadow-xl' : 'hidden sm:block'}`}>
          <PlantSidebar onDragStart={setDragging} />
          {mobileSidebarOpen && (
            <button
              className="absolute top-2 right-2 z-40 h-6 w-6 rounded-full bg-muted flex items-center justify-center"
              onClick={() => setMobileSidebarOpen(false)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
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
            sunExposure={(() => {
              const cellsPerUnit = settings.unit === 'meters' ? (100 / settings.cellSizeCm) : (30.48 / settings.cellSizeCm);
              const c = Math.round(settings.widthM * cellsPerUnit);
              const r = Math.round(settings.heightM * cellsPerUnit);
              const zones = calculateShadeZones(placedStructures, settings, c, r);
              return getSunExposure(selectedPlant.x, selectedPlant.y, zones);
            })()}
          />
        )}
      </div>

      {/* Modals */}
      {showCalendar && <PlantingCalendar placedPlants={placedPlants} onClose={() => setShowCalendar(false)} />}
      {showAI && <AIChat settings={settings} plants={placedPlants} location={location} onClose={() => setShowAI(false)} />}
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
        <WeatherYieldPanel plants={placedPlants} location={location} onClose={() => setShowWeather(false)} />
      )}
      {showRotation && (
        <RotationPanel
          plants={placedPlants}
          onOptimize={handleOptimizeRotation}
          onClose={() => setShowRotation(false)}
        />
      )}
      {showWatering && (
        <WateringGuide
          plants={placedPlants}
          structures={placedStructures}
          location={location}
          onClose={() => setShowWatering(false)}
        />
      )}
    </div>
  );
};

export default Index;
