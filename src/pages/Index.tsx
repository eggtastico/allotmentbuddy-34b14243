import { useState, useCallback, useMemo, useEffect, useRef } from 'react';

import { PlacedPlant, PlotSettings, PlacedStructure, PlantStage } from '@/types/garden';
import { PlantSidebar } from '@/components/PlantSidebar';
import { GardenGrid } from '@/components/GardenGrid';
import { PlantInfoPanel } from '@/components/PlantInfoPanel';
import { getStructureById } from '@/data/structures';
import { getPlantById, plants as allPlantsList } from '@/data/plants';
import { useFavouritePlants } from '@/hooks/useFavouritePlants';
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
import { ActionRequired } from '@/components/ActionRequired';
import { SocialShare } from '@/components/SocialShare';
import { useGardenPlans } from '@/hooks/useGardenPlans';
import { useAuth } from '@/hooks/useAuth';
import { exportGardenPDF } from '@/utils/exportPDF';
import { optimizeRotation } from '@/utils/rotationOptimizer';
import { calculateShadeZones, getSunExposure } from '@/utils/sunCalculator';
import { Sprout, Calendar, Bot, Download, FolderOpen, User, LogOut, Shuffle, CloudSun, Droplets, Menu, X, BookOpen, Map, HelpCircle, Package, Lightbulb, ListTodo, CalendarRange, Sparkles, Undo2, Redo2, History, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface LocationData {
  name: string;
  lat: number;
  lon: number;
  region?: string;
}

const Index = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const { plans, save, isSaving } = useGardenPlans();
  const { getFavouritesWithQuantity, getFavouriteIds } = useFavouritePlants();

  const [settings, setSettings] = useState<PlotSettings>({
    widthM: 6, heightM: 4, unit: 'meters', cellSizePx: 32, cellSizeCm: 20, southDirection: 180, snapToGrid: true,
  });
  const [placedPlants, setPlacedPlants] = useState<PlacedPlant[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<PlacedPlant | null>(null);
  const [placedStructures, setPlacedStructures] = useState<PlacedStructure[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
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
    setPlacedStructures(((latest.beds as any[]) || []).map((s: any) => ({
      id: s.id || `struct-${Date.now()}`,
      structureId: s.structureId || s.type || 'raised-bed',
      x: s.x ?? 0,
      y: s.y ?? 0,
      widthCells: s.widthCells ?? s.width ?? 4,
      heightCells: s.heightCells ?? s.height ?? 2,
    })));
  }, [user, plans]);

  // Auto-save with debounce (3s after last change)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!user || (placedPlants.length === 0 && placedStructures.length === 0)) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      save({ id: currentPlanId ?? undefined, name: planName, settings, plants: placedPlants, beds: placedStructures as any })
        .then((result: any) => {
          if (!currentPlanId && result?.id) setCurrentPlanId(result.id);
        })
        .catch(() => {});
    }, 3000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [placedPlants, placedStructures, settings, user]);

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
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handlePlacePlant = useCallback((plantId: string, x: number, y: number) => {
    // Check spacing: new plant must be far enough from same-type plants
    const plantData = getPlantById(plantId);
    const spacingCells = plantData ? Math.max(1, plantData.spacingCm / settings.cellSizeCm) : 1;
    const tooClose = placedPlants.some(p => {
      const dist = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
      if (dist < 0.5) return true; // overlapping
      if (p.plantId === plantId && dist < spacingCells) return true; // same plant too close
      return false;
    });
    if (tooClose) {
      setDragging(null);
      toast.error(`${plantData?.name || 'Plant'} needs ${plantData?.spacingCm || 20}cm spacing`);
      return;
    }
    pushUndo(placedPlants);
    setPlacedPlants(prev => [...prev, {
      id: `${plantId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      plantId, x, y,
      plantedAt: new Date().toISOString(),
      stage: defaultStage,
    }]);
    setDragging(null);
  }, [placedPlants, defaultStage, pushUndo, settings.cellSizeCm]);

  const handleFillPlantArea = useCallback((plantId: string, originX: number, originY: number, w: number, h: number) => {
    pushUndo(placedPlants);
    const plantData = getPlantById(plantId);
    const spacingCells = plantData ? Math.max(1, Math.ceil(plantData.spacingCm / settings.cellSizeCm)) : 1;
    setPlacedPlants(prev => {
      const newPlants: PlacedPlant[] = [];
      const allPlants = [...prev];
      // Step by spacing interval instead of every cell
      for (let dy = 0; dy < h; dy += spacingCells) {
        for (let dx = 0; dx < w; dx += spacingCells) {
          const px = originX + dx;
          const py = originY + dy;
          // Check no existing plant is too close
          const blocked = allPlants.some(p => {
            const dist = Math.sqrt((p.x - px) ** 2 + (p.y - py) ** 2);
            return dist < spacingCells * 0.9;
          });
          if (blocked) continue;
          const np: PlacedPlant = {
            id: `${plantId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${dx}-${dy}`,
            plantId, x: px, y: py,
            plantedAt: new Date().toISOString(),
            stage: defaultStage,
          };
          newPlants.push(np);
          allPlants.push(np);
        }
      }
      return [...prev, ...newPlants];
    });
  }, [placedPlants, pushUndo, settings.cellSizeCm]);

  const handleSmartAutoFill = useCallback((originX: number, originY: number, w: number, h: number, isContainer: boolean) => {
    pushUndo(placedPlants);
    const favs = getFavouritesWithQuantity();

    const slots: { plantId: string; maxQty: number; spacingCells: number }[] = [];

    const existingCounts: Record<string, number> = {};
    for (const p of placedPlants) {
      existingCounts[p.plantId] = (existingCounts[p.plantId] || 0) + 1;
    }

    for (const fav of favs) {
      const plant = getPlantById(fav.plantId);
      if (!plant) continue;
      if (isContainer && plant.spacingCm > 50) continue;
      const spacingCells = Math.max(1, Math.ceil(plant.spacingCm / settings.cellSizeCm));
      const existing = existingCounts[fav.plantId] || 0;
      const remaining = fav.quantity > 0 ? Math.max(0, fav.quantity - existing) : Infinity;
      if (remaining <= 0) continue;
      slots.push({ plantId: fav.plantId, maxQty: remaining === Infinity ? 9999 : remaining, spacingCells });
    }

    if (slots.length === 0) {
      const suggested = allPlantsList.filter(p => !isContainer || p.spacingCm <= 50).slice(0, 3);
      for (const p of suggested) {
        slots.push({ plantId: p.id, maxQty: 9999, spacingCells: Math.max(1, Math.ceil(p.spacingCm / settings.cellSizeCm)) });
      }
    }

    setPlacedPlants(prev => {
      const newPlants: PlacedPlant[] = [];
      const allPlants = [...prev];

      const positions: { x: number; y: number }[] = [];
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          positions.push({ x: originX + dx, y: originY + dy });
        }
      }

      for (const slot of slots) {
        let placed = 0;
        for (const pos of positions) {
          if (placed >= slot.maxQty) break;
          const tooClose = allPlants.some(p => {
            const dist = Math.sqrt((p.x - pos.x) ** 2 + (p.y - pos.y) ** 2);
            if (dist < 0.5) return true;
            if (p.plantId === slot.plantId && dist < slot.spacingCells * 0.9) return true;
            return false;
          });
          if (tooClose) continue;

          const np: PlacedPlant = {
            id: `${slot.plantId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${pos.x}-${pos.y}`,
            plantId: slot.plantId, x: pos.x, y: pos.y,
            plantedAt: new Date().toISOString(),
            stage: defaultStage,
          };
          newPlants.push(np);
          allPlants.push(np);
          placed++;
        }
      }

      return [...prev, ...newPlants];
    });
  }, [placedPlants, pushUndo, settings.cellSizeCm, defaultStage, getFavouritesWithQuantity]);

  const handleRemovePlant = useCallback((id: string) => {
    pushUndo(placedPlants);
    setPlacedPlants(prev => prev.filter(p => p.id !== id));
    if (selectedPlant?.id === id) setSelectedPlant(null);
  }, [selectedPlant, pushUndo, placedPlants]);

  const handleMovePlantStart = useCallback(() => {
    pushUndo(placedPlants);
  }, [placedPlants, pushUndo]);

  const handleMovePlant = useCallback((id: string, x: number, y: number) => {
    const plantToMove = placedPlants.find(p => p.id === id);
    if (!plantToMove) return;

    const positionUnchanged = plantToMove.x === x && plantToMove.y === y;
    const occupied = placedPlants.some(p => p.id !== id && p.x === x && p.y === y);
    if (positionUnchanged || occupied) return;

    setPlacedPlants(prev => prev.map(p => p.id === id ? { ...p, x, y } : p));
    setSelectedPlant(prev => prev?.id === id ? { ...prev, x, y } : prev);
  }, [placedPlants]);

  const handleClear = useCallback(() => {
    setShowClearConfirm(true);
  }, []);

  const confirmClear = useCallback(() => {
    pushUndo(placedPlants);
    setPlacedPlants([]);
    setPlacedStructures([]);
    setSelectedPlant(null);
    setShowClearConfirm(false);
  }, [placedPlants, pushUndo]);

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
    setDragging(null);
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

  const handleLoadPlan = useCallback((plan: any) => {
    setCurrentPlanId(plan.id);
    setPlanName(plan.name);
    setSettings(plan.plot_settings as PlotSettings);
    setPlacedPlants(((plan.plants as any[]) || []).map(p => ({
      ...p,
      plantedAt: p.plantedAt || new Date().toISOString(),
      stage: p.stage || 'seed',
    })));
    setPlacedStructures(((plan.beds as any[]) || []).map((s: any) => ({
      id: s.id || `struct-${Date.now()}`,
      structureId: s.structureId || s.type || 'raised-bed',
      x: s.x ?? 0,
      y: s.y ?? 0,
      widthCells: s.widthCells ?? s.width ?? 4,
      heightCells: s.heightCells ?? s.height ?? 2,
    })));
    setSelectedPlant(null);
    toast.success(`Loaded "${plan.name}" 🌿`);
  }, []);

  const handleNewPlan = useCallback(() => {
    setCurrentPlanId(null);
    setPlanName('My Garden');
    setSettings({ widthM: 6, heightM: 4, unit: 'meters', cellSizePx: 32, cellSizeCm: 20, southDirection: 180 });
    setPlacedPlants([]);
    setPlacedStructures([]);
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

  const closeMenu = () => setMobileMenuOpen(false);

  const NavDropdown = ({ label, icon: Icon, children }: { label: string; icon: any; children: React.ReactNode }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1">
          <Icon className="h-3.5 w-3.5" />
          {label}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const desktopNav = (
    <>
      <NavDropdown label="Plan" icon={Calendar}>
        <DropdownMenuItem onClick={() => setShowCalendar(true)}>
          <Calendar className="h-4 w-4 mr-2" /> Planting Calendar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setShowMonthlyPlanner(true)}>
          <CalendarRange className="h-4 w-4 mr-2" /> Monthly Planner
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setShowRotation(true)}>
          <Shuffle className="h-4 w-4 mr-2" /> Crop Rotation
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setShowPlotMap(true)}>
          <Map className="h-4 w-4 mr-2" /> Plot Map
        </DropdownMenuItem>
      </NavDropdown>

      <NavDropdown label="Grow" icon={Sparkles}>
        <DropdownMenuItem onClick={() => setShowGrowGuide(true)}>
          <Sparkles className="h-4 w-4 mr-2" /> Grow Guide
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setShowAI(true)}>
          <Bot className="h-4 w-4 mr-2" /> AI Assistant
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setShowPlantingSuggestions(true)}>
          <Lightbulb className="h-4 w-4 mr-2" /> Suggestions
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setShowWeather(true)}>
          <CloudSun className="h-4 w-4 mr-2" /> Weather & Yield
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setShowWatering(true)}>
          <Droplets className="h-4 w-4 mr-2" /> Watering Guide
        </DropdownMenuItem>
      </NavDropdown>

      <NavDropdown label="Track" icon={ListTodo}>
        <DropdownMenuItem onClick={() => setShowTasks(true)}>
          <ListTodo className="h-4 w-4 mr-2" /> Tasks
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setShowSeedInventory(true)}>
          <Package className="h-4 w-4 mr-2" /> Seed Inventory
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setShowJournal(true)}>
          <BookOpen className="h-4 w-4 mr-2" /> Journal
        </DropdownMenuItem>
      </NavDropdown>

      <NavDropdown label="More" icon={HelpCircle}>
        <DropdownMenuItem onClick={() => setShowDocs(true)}>
          <HelpCircle className="h-4 w-4 mr-2" /> Guide & Docs
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExportPDF()}>
          <Download className="h-4 w-4 mr-2" /> Export PDF
        </DropdownMenuItem>
        {user && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowSaveLoad(true)}>
              <FolderOpen className="h-4 w-4 mr-2" /> My Gardens
            </DropdownMenuItem>
          </>
        )}
      </NavDropdown>
    </>
  );

  const mobileNavItems = (
    <div className="grid grid-cols-2 gap-1 p-2">
      <DropdownMenuLabel className="col-span-2 text-[10px] text-muted-foreground uppercase tracking-wider">Plan</DropdownMenuLabel>
      <Button variant="ghost" size="sm" className="h-8 text-xs justify-start" onClick={() => { setShowCalendar(true); closeMenu(); }}>
        <Calendar className="h-3.5 w-3.5 mr-1.5" /> Calendar
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs justify-start" onClick={() => { setShowMonthlyPlanner(true); closeMenu(); }}>
        <CalendarRange className="h-3.5 w-3.5 mr-1.5" /> Planner
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs justify-start" onClick={() => { setShowRotation(true); closeMenu(); }}>
        <Shuffle className="h-3.5 w-3.5 mr-1.5" /> Rotation
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs justify-start" onClick={() => { setShowPlotMap(true); closeMenu(); }}>
        <Map className="h-3.5 w-3.5 mr-1.5" /> Plot Map
      </Button>

      <DropdownMenuLabel className="col-span-2 text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Grow</DropdownMenuLabel>
      <Button variant="ghost" size="sm" className="h-8 text-xs justify-start" onClick={() => { setShowGrowGuide(true); closeMenu(); }}>
        <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Grow Guide
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs justify-start" onClick={() => { setShowAI(true); closeMenu(); }}>
        <Bot className="h-3.5 w-3.5 mr-1.5" /> AI Help
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs justify-start" onClick={() => { setShowPlantingSuggestions(true); closeMenu(); }}>
        <Lightbulb className="h-3.5 w-3.5 mr-1.5" /> Suggestions
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs justify-start" onClick={() => { setShowWeather(true); closeMenu(); }}>
        <CloudSun className="h-3.5 w-3.5 mr-1.5" /> Weather
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs justify-start" onClick={() => { setShowWatering(true); closeMenu(); }}>
        <Droplets className="h-3.5 w-3.5 mr-1.5" /> Watering
      </Button>

      <DropdownMenuLabel className="col-span-2 text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Track</DropdownMenuLabel>
      <Button variant="ghost" size="sm" className="h-8 text-xs justify-start" onClick={() => { setShowTasks(true); closeMenu(); }}>
        <ListTodo className="h-3.5 w-3.5 mr-1.5" /> Tasks
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs justify-start" onClick={() => { setShowSeedInventory(true); closeMenu(); }}>
        <Package className="h-3.5 w-3.5 mr-1.5" /> Seeds
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs justify-start" onClick={() => { setShowJournal(true); closeMenu(); }}>
        <BookOpen className="h-3.5 w-3.5 mr-1.5" /> Journal
      </Button>

      <DropdownMenuLabel className="col-span-2 text-[10px] text-muted-foreground uppercase tracking-wider mt-1">More</DropdownMenuLabel>
      <Button variant="ghost" size="sm" className="h-8 text-xs justify-start" onClick={() => { setShowDocs(true); closeMenu(); }}>
        <HelpCircle className="h-3.5 w-3.5 mr-1.5" /> Guide
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs justify-start" onClick={() => { handleExportPDF(); closeMenu(); }}>
        <Download className="h-3.5 w-3.5 mr-1.5" /> PDF
      </Button>
      {user ? (
        <>
          <Button variant="ghost" size="sm" className="h-8 text-xs justify-start" onClick={() => { setShowSaveLoad(true); closeMenu(); }}>
            <FolderOpen className="h-3.5 w-3.5 mr-1.5" /> My Gardens
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs justify-start" onClick={() => { signOut(); closeMenu(); }}>
            <LogOut className="h-3.5 w-3.5 mr-1.5" /> Sign Out
          </Button>
        </>
      ) : (
        <Button variant="outline" size="sm" className="h-8 text-xs justify-start" onClick={() => { setShowAuth(true); closeMenu(); }}>
          <User className="h-3.5 w-3.5 mr-1.5" /> Sign In
        </Button>
      )}
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-background sm:pb-0 pb-14">
      <WelcomeModal />

      {/* Header */}
      <header className="h-16 border-b border-border bg-gradient-to-r from-primary/10 via-card to-secondary/10 px-4 flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md">
            <Sprout className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-bold text-primary text-xl leading-none">🌱 Allotment Buddy</h1>
            <p className="text-[10px] text-muted-foreground font-medium">Plan · Grow · Harvest</p>
          </div>
        </div>

        <LocationPicker location={location} onLocationChange={setLocation} />
        <RainWidget location={location} />

        {/* Desktop nav — grouped dropdowns */}
        <div className="hidden lg:flex items-center gap-1 ml-auto">
          {desktopNav}
          <div className="h-5 w-px bg-border mx-1" />
          <SocialShare />
          {user ? (
            <Button variant="ghost" size="sm" className="h-10 min-h-[40px] text-xs rounded-2xl" onClick={() => signOut()}>
              <LogOut className="h-4 w-4 mr-1" /> Sign Out
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="h-10 min-h-[40px] text-xs rounded-2xl" onClick={() => setShowAuth(true)}>
              <User className="h-4 w-4 mr-1" /> Sign In
            </Button>
          )}
          <DarkModeToggle />
        </div>

        {/* Mobile nav */}
        <div className="lg:hidden flex items-center gap-1.5 ml-auto">
          <SocialShare />
          <DarkModeToggle />
          <Button variant="ghost" size="icon" className="h-10 w-10 min-h-[40px] rounded-2xl sm:hidden" onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}>
            <Sprout className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10 min-h-[40px] rounded-2xl" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-border bg-card animate-fade-in">
          {mobileNavItems}
        </div>
      )}

      {/* Seasonal tasks widget */}
      <SeasonalTasks placedPlantIds={placedPlants.map(p => p.plantId)} />
      <ActionRequired placedPlants={placedPlants} />

      {/* Toolbar */}
      <div className="flex items-center border-b border-border bg-card flex-wrap">
        <div className="flex-1">
          <PlotToolbar settings={settings} onSettingsChange={setSettings} plantCount={placedPlants.length} onClear={handleClear} />
        </div>
        <div className="flex items-center gap-1 px-3 py-1 shrink-0">
          {/* Undo/Redo */}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleUndo} disabled={undoStack.length === 0} title="Undo">
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRedo} disabled={redoStack.length === 0} title="Redo">
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
          <div className="h-5 w-px bg-border mx-1" />

          {/* Rollback dropdown */}
          {user && plans.length > 0 && (
            <>
              <div className="relative">
                <select
                  className="h-7 text-xs border rounded px-2 bg-background text-foreground appearance-none pr-6 cursor-pointer"
                  value={currentPlanId || ''}
                  onChange={(e) => {
                    const plan = plans.find((p: any) => p.id === e.target.value);
                    if (plan) {
                      setCurrentPlanId(plan.id);
                      setPlanName(plan.name);
                      setSettings(plan.plot_settings as PlotSettings);
                      setPlacedPlants(((plan.plants as any[]) || []).map((p: any) => ({
                        ...p,
                        plantedAt: p.plantedAt || new Date().toISOString(),
                        stage: p.stage || 'seed',
                      })));
                      setSelectedPlant(null);
                      setUndoStack([]);
                      setRedoStack([]);
                      toast.success(`Loaded "${plan.name}" 🌿`);
                    }
                  }}
                >
                  {plans.map((plan: any) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} — {new Date(plan.updated_at).toLocaleDateString('en-GB')}
                    </option>
                  ))}
                </select>
                <History className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
              </div>
              <div className="h-5 w-px bg-border mx-1" />
            </>
          )}

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
          {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-1" />}
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
          onMovePlant={handleMovePlant}
          onMovePlantStart={handleMovePlantStart}
          onSelectPlant={setSelectedPlant}
          onPlaceStructure={handlePlaceStructure}
          onRemoveStructure={handleRemoveStructure}
          onResizeStructure={handleResizeStructure}
          onMoveStructure={handleMoveStructure}
          selectedPlantId={selectedPlant?.id ?? null}
          onFillPlantArea={handleFillPlantArea}
          onSmartAutoFill={handleSmartAutoFill}
          onSettingsChange={setSettings}
          draggingPlantId={dragging}
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
            onAddSuccessionTask={async (title, description) => {
              if (!user) {
                toast.error('Sign in to add tasks');
                return;
              }
              const { error } = await supabase.from('garden_tasks').insert({
                user_id: user.id,
                title,
                description,
                period: 'monthly',
              });
              if (error) {
                toast.error('Failed to add task');
              } else {
                toast.success('Succession task added! 📋');
              }
            }}
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
          beds={placedStructures as any}
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
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear this garden plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all placed plants and structures from your current layout.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmClear}>
              Delete plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
