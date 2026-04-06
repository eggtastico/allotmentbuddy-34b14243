import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { PlacedPlant, PlotSettings, PlacedStructure, PlantStage } from '@/types/garden';
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
import { SeasonalTasks } from '@/components/SeasonalTasks';
import { PlotMapPanel } from '@/components/PlotMapPanel';
import { GardenJournal } from '@/components/GardenJournal';
import { RainWidget } from '@/components/RainWidget';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { DocsGuide } from '@/components/DocsGuide';
import { SeedInventory } from '@/components/SeedInventory';
import { PlantingSuggestions } from '@/components/PlantingSuggestions';
import { GardenTasks } from '@/components/GardenTasks';
import { MonthlyPlanner } from '@/components/MonthlyPlanner';
import { GrowGuide } from '@/components/GrowGuide';
import { useGardenPlans } from '@/hooks/useGardenPlans';
import { useAuth } from '@/hooks/useAuth';
import { exportGardenPDF } from '@/utils/exportPDF';
import { optimizeRotation } from '@/utils/rotationOptimizer';
import { calculateShadeZones, getSunExposure } from '@/utils/sunCalculator';
import { Sprout, Calendar, Bot, Download, FolderOpen, User, LogOut, Shuffle, CloudSun, Droplets, Menu, X, BookOpen, Map, HelpCircle, Package, Lightbulb, ListTodo, CalendarRange, Sparkles, Undo2, Redo2, History } from 'lucide-react';
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
  const { plans, save, isSaving } = useGardenPlans();

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
  const [defaultStage, setDefaultStage] = useState<PlantStage>('seed');

  // Undo/Redo history
  const [undoStack, setUndoStack] = useState<PlacedPlant[][]>([]);
  const [redoStack, setRedoStack] = useState<PlacedPlant[][]>([]);
  const skipHistoryRef = useRef(false);

  const pushUndo = useCallback((prev: PlacedPlant[]) => {
    setUndoStack(s => [...s.slice(-49), prev]);
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0, -1));
    setRedoStack(s => [...s, placedPlants]);
    skipHistoryRef.current = true;
    setPlacedPlants(prev);
    setSelectedPlant(null);
  }, [undoStack, placedPlants]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(s => s.slice(0, -1));
    setUndoStack(s => [...s, placedPlants]);
    skipHistoryRef.current = true;
    setPlacedPlants(next);
    setSelectedPlant(null);
  }, [redoStack, placedPlants]);

  // Auto-load most recent plan on mount
  const autoLoaded = useRef(false);
  useEffect(() => {
    if (autoLoaded.current || !user || plans.length === 0) return;
    autoLoaded.current = true;
    const latest = plans[0]; // already sorted by updated_at desc
    setCurrentPlanId(latest.id);
    setPlanName(latest.name);
    setSettings(latest.plot_settings as PlotSettings);
    setPlacedPlants(((latest.plants as any[]) || []).map((p: any) => ({
      ...p,
      plantedAt: p.plantedAt || new Date().toISOString(),
      stage: p.stage || 'seed',
    })));
  }, [user, plans]);

  // Auto-save with debounce (3s after last change)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!user || placedPlants.length === 0) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      save({ id: currentPlanId ?? undefined, name: planName, settings, plants: placedPlants, beds: [] })
        .then((result: any) => {
          if (!currentPlanId && result?.id) setCurrentPlanId(result.id);
        })
        .catch(() => {});
    }, 3000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [placedPlants, settings, user]);

  // Modals
  const [showCalendar, setShowCalendar] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showSaveLoad, setShowSaveLoad] = useState(false);
  const [showRotation, setShowRotation] = useState(false);
  const [showWeather, setShowWeather] = useState(false);
  const [showWatering, setShowWatering] = useState(false);
  const [showPlotMap, setShowPlotMap] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [showSeedInventory, setShowSeedInventory] = useState(false);
  const [showPlantingSuggestions, setShowPlantingSuggestions] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [showMonthlyPlanner, setShowMonthlyPlanner] = useState(false);
  const [showGrowGuide, setShowGrowGuide] = useState(false);

  const handlePlacePlant = useCallback((plantId: string, x: number, y: number) => {
    const occupied = placedPlants.some(p => p.x === x && p.y === y);
    if (occupied) return;
    pushUndo(placedPlants);
    setPlacedPlants(prev => [...prev, {
      id: `${plantId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      plantId, x, y,
      plantedAt: new Date().toISOString(),
      stage: defaultStage,
    }]);
  }, [placedPlants, defaultStage, pushUndo]);

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
              plantedAt: new Date().toISOString(),
              stage: defaultStage,
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
    setPlacedPlants(((plan.plants as any[]) || []).map(p => ({
      ...p,
      plantedAt: p.plantedAt || new Date().toISOString(),
      stage: p.stage || 'seed',
    })));
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
      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setShowDocs(true); setMobileMenuOpen(false); }}>
        <HelpCircle className="h-3.5 w-3.5 mr-1" /> Guide
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setShowCalendar(true); setMobileMenuOpen(false); }}>
        <Calendar className="h-3.5 w-3.5 mr-1" /> Calendar
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setShowAI(true); setMobileMenuOpen(false); }}>
        <Bot className="h-3.5 w-3.5 mr-1" /> AI Help
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setShowSeedInventory(true); setMobileMenuOpen(false); }}>
        <Package className="h-3.5 w-3.5 mr-1" /> Seeds
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setShowPlantingSuggestions(true); setMobileMenuOpen(false); }}>
        <Lightbulb className="h-3.5 w-3.5 mr-1" /> Suggestions
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setShowTasks(true); setMobileMenuOpen(false); }}>
        <ListTodo className="h-3.5 w-3.5 mr-1" /> Tasks
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setShowMonthlyPlanner(true); setMobileMenuOpen(false); }}>
        <CalendarRange className="h-3.5 w-3.5 mr-1" /> Planner
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setShowGrowGuide(true); setMobileMenuOpen(false); }}>
        <Sparkles className="h-3.5 w-3.5 mr-1" /> Grow Guide
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
      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setShowPlotMap(true); setMobileMenuOpen(false); }}>
        <Map className="h-3.5 w-3.5 mr-1" /> Plot Map
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setShowJournal(true); setMobileMenuOpen(false); }}>
        <BookOpen className="h-3.5 w-3.5 mr-1" /> Journal
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
    <div className="h-screen flex flex-col bg-background sm:pb-0 pb-14">
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
        <RainWidget location={location} />
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

      {/* Seasonal tasks widget */}
      <SeasonalTasks />

      {/* Toolbar */}
      <div className="flex items-center border-b border-border bg-card">
        <div className="flex-1">
          <PlotToolbar settings={settings} onSettingsChange={setSettings} plantCount={placedPlants.length} onClear={handleClear} />
        </div>
        <div className="flex items-center gap-1 px-3 py-1 shrink-0">
          <span className="text-xs text-muted-foreground mr-1">Planting as:</span>
          <Button
            variant={defaultStage === 'seed' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => setDefaultStage('seed')}
          >
            🌰 Seed
          </Button>
          <Button
            variant={defaultStage === 'seedling' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => setDefaultStage('seedling')}
          >
            🌱 Seedling
          </Button>
        </div>
      </div>

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
          onFillPlantArea={handleFillPlantArea}
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
      {showPlotMap && <PlotMapPanel onClose={() => setShowPlotMap(false)} />}
      {showJournal && <GardenJournal onClose={() => setShowJournal(false)} />}
      {showDocs && <DocsGuide onClose={() => setShowDocs(false)} />}
      {showSeedInventory && <SeedInventory onClose={() => setShowSeedInventory(false)} />}
      {showPlantingSuggestions && <PlantingSuggestions onClose={() => setShowPlantingSuggestions(false)} />}
      {showTasks && <GardenTasks onClose={() => setShowTasks(false)} />}
      {showMonthlyPlanner && <MonthlyPlanner onClose={() => setShowMonthlyPlanner(false)} />}
      {showGrowGuide && <GrowGuide onClose={() => setShowGrowGuide(false)} />}

      {/* Mobile bottom nav */}
      <MobileBottomNav
        onToggleSidebar={() => setMobileSidebarOpen(prev => !prev)}
        onShowCalendar={() => setShowCalendar(true)}
        onShowAI={() => setShowAI(true)}
        onShowJournal={() => setShowJournal(true)}
        onShowPlotMap={() => setShowPlotMap(true)}
        onShowWeather={() => setShowWeather(true)}
      />
    </div>
  );
};

export default Index;
