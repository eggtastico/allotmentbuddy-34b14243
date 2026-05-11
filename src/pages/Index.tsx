import React, { useState, useCallback, useMemo, useEffect, useRef, Suspense } from 'react';

import { PlacedPlant, PlotSettings, PlacedStructure, PlantStage } from '@/types/garden';
import { GardenPlanRow } from '@/lib/schemas';
import { db, initializeSyncStatus, getLocalGardens } from '@/lib/db';
import { AppShell, type NavSection } from '@/components/AppShell';
import { PhotosView } from '@/components/PhotosView';
import { BottomNavBar } from '@/components/BottomNavBar';
import { SetupWizard, type WizardSettings } from '@/components/SetupWizard';
import { InstallPrompt } from '@/components/InstallPrompt';
import { PlantSidebar } from '@/components/PlantSidebar';
import { GardenGrid } from '@/components/GardenGrid';
import { IsometricGardenGrid } from '@/components/IsometricGardenGrid';
import { PlantInfoPanel } from '@/components/PlantInfoPanel';
import { BedInfoPanel } from '@/components/BedInfoPanel';
import { getStructureById } from '@/data/structures';
import { getPlantById, plants as allPlantsList } from '@/data/plants';
import { useFavouritePlants } from '@/hooks/useFavouritePlants';
import { PlotToolbar } from '@/components/PlotToolbar';
import { MobilePlantTray } from '@/components/MobilePlantTray';
import { WelcomeModal } from '@/components/WelcomeModal';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { LocationPicker } from '@/components/LocationPicker';
import { RainWidget } from '@/components/RainWidget';
import { GardenAssistantPanel } from '@/components/GardenAssistantPanel';
import { SocialShare } from '@/components/SocialShare';
import { SyncStatusBar } from '@/components/SyncStatusBar';
import { SuccessionSlider } from '@/components/SuccessionSlider';
import { PanelSkeleton } from '@/components/PanelSkeleton';
import { ModalContainer } from '@/components/ModalContainer';
// GardenTasks is also used inline on mobile (not in ModalContainer)
const GardenTasks = React.lazy(() => import('@/components/GardenTasks').then(m => ({ default: m.GardenTasks })));
import { useGardenPlans } from '@/hooks/useGardenPlans';
import { useAuth } from '@/hooks/use-auth';
import { useGardenAutoSave } from '@/hooks/useGardenAutoSave';
import { useGardenModals } from '@/hooks/useGardenModals';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFrostDates } from '@/hooks/useFrostDates';
import { useConflictResolution } from '@/hooks/useConflictResolution';
import { ConflictDialog } from '@/components/ConflictDialog';
// exportGardenPDF is loaded on-demand to keep jsPDF out of the initial bundle
import { optimizeRotation } from '@/utils/rotationOptimizer';
import { calculateShadeZones, getSunExposure } from '@/utils/sunCalculator';
import { logError } from '@/utils/errorUtils';
import { Sprout, Calendar, Bot, Download, FolderOpen, User, LogOut, Shuffle, CloudSun, Droplets, Menu, X, BookOpen, Map, HelpCircle, Package, Lightbulb, ListTodo, CalendarRange, Sparkles, Undo2, Redo2, History, Loader2, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const { conflict, checkForConflict, resolveConflict } = useConflictResolution();

  const [settings, setSettings] = useState<PlotSettings>({
    widthM: 6, heightM: 4, unit: 'meters', cellSizePx: 32, cellSizeCm: 20, southDirection: 180, snapToGrid: true,
  });
  const [placedPlants, setPlacedPlants] = useState<PlacedPlant[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<PlacedPlant | null>(null);
  const [selectedBed, setSelectedBed] = useState<PlacedStructure | null>(null);
  const [placedStructures, setPlacedStructures] = useState<PlacedStructure[]>([]);
  const [dragging, setDragging] = useState<string | null>(null); // used only for drag-and-drop dataTransfer
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [planName, setPlanName] = useState('My Garden');
  const [location, setLocation] = useState<LocationData | null>(null);
  const frostDates = useFrostDates(location);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [pendingPlantId, setPendingPlantId] = useState<string | null>(null);
  const [pendingIsStructure, setPendingIsStructure] = useState(false);
  const [defaultStage, setDefaultStage] = useState<PlantStage>('seed');
  const [activeNav, setActiveNav] = useState<NavSection>('garden');
  const isMobile = useIsMobile();
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  // Isometric grid A/B flag — enable via ?iso=1 in URL or toggle button
  const [useIsometric, setUseIsometric] = useState(
    () => new URLSearchParams(window.location.search).get('iso') === '1'
  );
  // Succession planting slider — month view and visibility
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [showSuccessionSlider, setShowSuccessionSlider] = useState(false);

  // Auto-save flash indicator
  const [showSaved, setShowSaved] = useState(false);
  const wasSavingRef = useRef(false);
  useEffect(() => {
    if (wasSavingRef.current && !isSaving) {
      setShowSaved(true);
      const t = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(t);
    }
    wasSavingRef.current = isSaving;
  }, [isSaving]);

  // Undo/Redo history
  const [undoStack, setUndoStack] = useState<PlacedPlant[][]>([]);
  const [redoStack, setRedoStack] = useState<PlacedPlant[][]>([]);
  const skipHistoryRef = useRef(false);
  const exportingRef = useRef(false);

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

  const handleWizardComplete = (wizardSettings: WizardSettings) => {
    // Apply wizard settings to the app
    setSettings({
      widthM: wizardSettings.widthM,
      heightM: wizardSettings.heightM,
      unit: wizardSettings.unit,
      cellSizePx: 32,
      cellSizeCm: 20,
      southDirection: 180,
      snapToGrid: true,
    });

    if (wizardSettings.location) {
      setLocation({
        name: wizardSettings.location.name,
        lat: wizardSettings.location.lat,
        lon: wizardSettings.location.lon,
      });
    }

    setShowSetupWizard(false);
  };

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(s => s.slice(0, -1));
    setUndoStack(s => [...s, placedPlants]);
    skipHistoryRef.current = true;
    setPlacedPlants(next);
    setSelectedPlant(null);
  }, [redoStack, placedPlants]);

  // Keyboard shortcuts: Ctrl+Z for undo, Ctrl+Y / Ctrl+Shift+Z for redo
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        (e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))
      ) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo]);

  // Initialize IndexedDB on mount
  useEffect(() => {
    initializeSyncStatus().catch(console.error);
  }, []);

  // Check if setup wizard has been completed
  useEffect(() => {
    const setupComplete = localStorage.getItem('allotment-setup-complete');
    if (!setupComplete && !user) {
      // Show wizard for new users
      setTimeout(() => setShowSetupWizard(true), 500);
    }
  }, [user]);

  // Auto-load most recent plan: prefer remote plans from Supabase, fall back to IndexedDB
  const autoLoaded = useRef(false);
  const prevUserRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    // Reset the guard when the user identity changes (login, logout, switch account)
    if (prevUserRef.current !== undefined && prevUserRef.current !== (user?.id ?? null)) {
      autoLoaded.current = false;
    }
    prevUserRef.current = user?.id ?? null;

    if (autoLoaded.current) return;

    if (user && plans.length > 0) {
      // Load from Supabase
      autoLoaded.current = true;
      const latest = plans[0]; // already sorted by updated_at desc
      setCurrentPlanId(latest.id);
      setPlanName(latest.name);
      setSettings(latest.plot_settings);
      // Plans are already validated and transformed by GardenPlansResponseSchema
      setPlacedPlants(latest.plants || []);
      setPlacedStructures(latest.beds || []);
    } else if (!user || (plans.length === 0 && user)) {
      // Load from IndexedDB for offline support or if no remote plans
      getLocalGardens()
        .then((localPlans) => {
          if (localPlans.length > 0) {
            autoLoaded.current = true;
            const latest = localPlans[localPlans.length - 1]; // Most recently saved
            setCurrentPlanId(latest.id);
            setPlanName(latest.name);
            setSettings(latest.settings);
            setPlacedPlants(latest.plants || []);
            setPlacedStructures(latest.beds || []);
          }
        })
        .catch((err) => {
          logError(err, 'Failed to load garden plans from IndexedDB');
        });
    }
  }, [user, plans]);

  // Auto-save with debounce (3s after last change)
  useGardenAutoSave(placedPlants, placedStructures, settings, currentPlanId, planName, setCurrentPlanId);

  // Modal state management
  const {
    showCalendar, setShowCalendar,
    showAI, setShowAI,
    showAuth, setShowAuth,
    showSaveLoad, setShowSaveLoad,
    showRotation, setShowRotation,
    showWeather, setShowWeather,
    showWatering, setShowWatering,
    showPlotMap, setShowPlotMap,
    showJournal, setShowJournal,
    showDocs, setShowDocs,
    showSeedInventory, setShowSeedInventory,
    showPlantingSuggestions, setShowPlantingSuggestions,
    showTasks, setShowTasks,
    showMonthlyPlanner, setShowMonthlyPlanner,
    showGrowGuide, setShowGrowGuide,
    showClearConfirm, setShowClearConfirm,
    showShoppingList, setShowShoppingList,
    showHarvestLogger, setShowHarvestLogger,
    showPestLog, setShowPestLog,
    showRotationPlanner, setShowRotationPlanner,
  } = useGardenModals();

  const handleSelectForPlacement = useCallback((plantId: string, isStructure = false) => {
    setPendingPlantId(prev => prev === plantId ? null : plantId);
    setPendingIsStructure(isStructure);
    if (mobileSidebarOpen) setMobileSidebarOpen(false);
  }, [mobileSidebarOpen]);

  const handleCancelPending = useCallback(() => {
    setPendingPlantId(null);
    setPendingIsStructure(false);
  }, []);

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

    // Frost warning: alert if placing a frost-sensitive plant within 4 weeks of last frost date
    if (plantData && frostDates && (plantData.frostHardiness === 'tender' || plantData.frostHardiness === 'half-hardy')) {
      const now = new Date();
      const lastFrost = frostDates.lastFrostDate;
      const daysToLastFrost = Math.ceil((lastFrost.getTime() - now.getTime()) / 86400000);
      if (daysToLastFrost > 0 && daysToLastFrost <= 28) {
        toast.warning(
          `⚠️ Frost risk: ${plantData.name} is ${plantData.frostHardiness} — last frost expected in ~${daysToLastFrost} days. Consider waiting or using protection.`,
          { duration: 6000 }
        );
      }
    }

    pushUndo(placedPlants);
    setPlacedPlants(prev => [...prev, {
      id: `${plantId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      plantId, x, y,
      plantedAt: new Date().toISOString(),
      stage: defaultStage,
    }]);
    setDragging(null);
  }, [placedPlants, defaultStage, pushUndo, settings.cellSizeCm, frostDates]);

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
  }, [placedPlants, pushUndo, settings.cellSizeCm, defaultStage]);

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
    const removed = placedPlants.find(p => p.id === id);
    pushUndo(placedPlants);
    setPlacedPlants(prev => prev.filter(p => p.id !== id));
    if (selectedPlant?.id === id) setSelectedPlant(null);

    if (removed) {
      const name = getPlantById(removed.plantId)?.name ?? 'Plant';
      toast(`${name} removed`, {
        action: {
          label: 'Undo',
          onClick: () => handleUndo(),
        },
        duration: 5000,
      });
    }
  }, [selectedPlant, pushUndo, placedPlants, handleUndo]);

  const handleUpdatePlacedPlant = useCallback((updated: PlacedPlant) => {
    setPlacedPlants(prev => prev.map(p => p.id === updated.id ? updated : p));
    setSelectedPlant(prev => prev?.id === updated.id ? updated : prev);
  }, []);

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
  }, [setShowClearConfirm]);

  const confirmClear = useCallback(() => {
    pushUndo(placedPlants);
    setPlacedPlants([]);
    setPlacedStructures([]);
    setSelectedPlant(null);
    setShowClearConfirm(false);
  }, [placedPlants, pushUndo, setShowClearConfirm]);

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

  const handleUpdateStructure = useCallback((updated: PlacedStructure) => {
    setPlacedStructures(prev => prev.map(s => s.id === updated.id ? updated : s));
    setSelectedBed(prev => prev?.id === updated.id ? updated : prev);
  }, []);

  const applyPlan = useCallback((plan: GardenPlanRow) => {
    setCurrentPlanId(plan.id);
    setPlanName(plan.name);
    setSettings(plan.plot_settings as PlotSettings);
    setPlacedPlants(((plan.plants as PlacedPlant[]) || []).map(p => ({
      ...p,
      plantedAt: p.plantedAt || new Date().toISOString(),
      stage: p.stage || 'seed' as PlantStage,
    })));
    setPlacedStructures(((plan.beds as PlacedStructure[]) || []).map((s: PlacedStructure) => ({
      id: s.id || `struct-${Date.now()}`,
      structureId: s.structureId || s.type || 'raised-bed',
      x: s.x ?? 0,
      y: s.y ?? 0,
      widthCells: s.widthCells ?? s.width ?? 4,
      heightCells: s.heightCells ?? s.height ?? 2,
      name: s.name,
      rotationHistory: s.rotationHistory,
    })));
    setSelectedPlant(null);
    setSelectedBed(null);
    toast.success(`Loaded "${plan.name}" 🌿`);
  }, []);

  const handleLoadPlan = useCallback(async (plan: GardenPlanRow) => {
    const resolved = await checkForConflict(plan);
    if (resolved) applyPlan(resolved);
    // If null, the conflict dialog is shown and will call handleConflictResolve
  }, [checkForConflict, applyPlan]);

  const handleConflictResolve = useCallback(async (choice: 'local' | 'remote' | null) => {
    const resolved = await resolveConflict(choice);
    if (resolved) applyPlan(resolved);
  }, [resolveConflict, applyPlan]);

  const handleNewPlan = useCallback(() => {
    setCurrentPlanId(null);
    setPlanName('My Garden');
    setSettings({ widthM: 6, heightM: 4, unit: 'meters', cellSizePx: 32, cellSizeCm: 20, southDirection: 180 });
    setPlacedPlants([]);
    setPlacedStructures([]);
    setSelectedPlant(null);
    setSelectedBed(null);
  }, []);

  const handleExportPDF = async () => {
    if (exportingRef.current) return;
    exportingRef.current = true;
    try {
      const { exportGardenPDF } = await import('@/utils/exportPDF');
      await exportGardenPDF(settings, placedPlants, planName);
      toast.success('PDF exported! 📄');
    } catch {
      toast.error('Failed to export PDF');
    } finally {
      exportingRef.current = false;
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

  const NavDropdown = ({ label, icon: Icon, children }: { label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; children: React.ReactNode }) => (
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
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setShowHarvestLogger(true)}>
          <Sprout className="h-4 w-4 mr-2" /> Harvest Log
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setShowPestLog(true)}>
          <Lightbulb className="h-4 w-4 mr-2" /> Pest & Disease Log
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setShowRotationPlanner(true)}>
          <Shuffle className="h-4 w-4 mr-2" /> Rotation Planner
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
    <div className="h-screen flex flex-col bg-background lg:pb-0 pb-16 touch-manipulation overscroll-none" style={{ overscrollBehavior: 'none' }}>
      <WelcomeModal />

      {/* Setup Wizard */}
      <SetupWizard
        isOpen={showSetupWizard}
        onComplete={handleWizardComplete}
        onSkip={() => setShowSetupWizard(false)}
      />

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

      {/* Install prompt */}
      <div className="px-4 py-2 bg-card border-b border-border">
        <InstallPrompt />
      </div>

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
                    const plan = plans.find((p: GardenPlanRow) => p.id === e.target.value);
                    if (plan) {
                      setCurrentPlanId(plan.id);
                      setPlanName(plan.name);
                      setSettings(plan.plot_settings as PlotSettings);
                      setPlacedPlants(((plan.plants as PlacedPlant[]) || []).map((p: PlacedPlant) => ({
                        ...p,
                        plantedAt: p.plantedAt || new Date().toISOString(),
                        stage: p.stage || 'seed' as PlantStage,
                      })));
                      setSelectedPlant(null);
                      setUndoStack([]);
                      setRedoStack([]);
                      toast.success(`Loaded "${plan.name}" 🌿`);
                    }
                  }}
                >
                  {plans.map((plan: GardenPlanRow) => (
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
          <div className="h-5 w-px bg-border mx-1" />
          {/* View mode toggle */}
          <Button
            variant={useIsometric ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => setUseIsometric(v => !v)}
            title={useIsometric ? 'Switch to flat grid' : 'Switch to isometric 3D view'}
          >
            {useIsometric ? '🏔️ Iso' : '🗺️ Flat'}
          </Button>
          {isSaving && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground ml-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </span>
          )}
          {showSaved && !isSaving && (
            <span className="flex items-center gap-1 text-[10px] text-green-600 ml-2 animate-in fade-in duration-300">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className={`${isMobile && activeNav !== 'garden' && activeNav !== 'crops' ? 'hidden' : 'flex-1 flex'} overflow-hidden relative`}>
        {/* Backdrop for mobile sidebar */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-20 sm:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}
        {/* Sidebar */}
        <div className={`${mobileSidebarOpen ? 'fixed inset-y-0 left-0 z-30 shadow-xl' : 'hidden sm:block'} w-full sm:w-64`}>
          <PlantSidebar
            onDragStart={setDragging}
            pendingPlantId={pendingPlantId}
            onSelectPlant={handleSelectForPlacement}
          />
          {mobileSidebarOpen && (
            <button
              className="absolute top-2 right-2 z-40 h-8 w-8 rounded-full bg-muted flex items-center justify-center"
              onClick={() => setMobileSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {useIsometric ? (
          <IsometricGardenGrid
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
            pendingPlantId={pendingPlantId}
            pendingIsStructure={pendingIsStructure}
            onCancelPending={handleCancelPending}
            viewMonth={showSuccessionSlider ? viewMonth : null}
            isMobile={isMobile}
            onSelectBed={bed => {
              setSelectedBed(bed);
              setSelectedPlant(null);
            }}
          />
        ) : (
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
            pendingPlantId={pendingPlantId}
            pendingIsStructure={pendingIsStructure}
            onCancelPending={handleCancelPending}
            viewMonth={showSuccessionSlider ? viewMonth : null}
            isMobile={isMobile}
            onSelectBed={bed => {
              setSelectedBed(bed);
              setSelectedPlant(null);
            }}
          />
        )}
        {selectedPlant && !isMobile && (
          <>
            {/* Desktop sidebar version */}
            <PlantInfoPanel
              placed={selectedPlant}
              allPlaced={placedPlants}
              onClose={() => setSelectedPlant(null)}
              onRemove={handleRemovePlant}
              onUpdatePlaced={handleUpdatePlacedPlant}
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
          </>
        )}
        {isMobile && selectedPlant && (
          <PlantInfoPanel
            placed={selectedPlant}
            allPlaced={placedPlants}
            onClose={() => setSelectedPlant(null)}
            onRemove={handleRemovePlant}
            onUpdatePlaced={handleUpdatePlacedPlant}
            modal={true}
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
        {selectedBed && !isMobile && (
          <>
            {/* Desktop sidebar version */}
            <BedInfoPanel
              bed={selectedBed}
              allBeds={placedStructures}
              allPlants={placedPlants}
              onClose={() => setSelectedBed(null)}
              onUpdateBed={handleUpdateStructure}
              onRemoveBed={handleRemoveStructure}
            />
          </>
        )}
        {isMobile && selectedBed && (
          <BedInfoPanel
            bed={selectedBed}
            allBeds={placedStructures}
            allPlants={placedPlants}
            onClose={() => setSelectedBed(null)}
            onUpdateBed={handleUpdateStructure}
            onRemoveBed={handleRemoveStructure}
            modal={true}
          />
        )}
      </div>

      {/* Succession Slider - Bottom Bar */}
      <SuccessionSlider
        viewMonth={viewMonth}
        onChange={setViewMonth}
        placedPlants={placedPlants}
        visible={showSuccessionSlider}
        onToggle={() => setShowSuccessionSlider(v => !v)}
      />

      {/* Mobile plant tray */}
      {isMobile && (activeNav === 'garden' || activeNav === 'crops') && (
        <MobilePlantTray
          pendingPlantId={pendingPlantId}
          onSelectPlant={handleSelectForPlacement}
        />
      )}

      {/* Mobile tap-to-place indicator */}
      {pendingPlantId && (
        <div className="fixed bottom-20 left-0 right-0 z-40 flex justify-center lg:hidden pointer-events-none">
          <div className="bg-primary text-primary-foreground text-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            {pendingIsStructure
              ? '🏗️ Tap the grid to place'
              : `Tap the grid to place · tap again to cancel`}
            <button
              className="ml-1 pointer-events-auto opacity-80"
              onClick={handleCancelPending}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile floating action button for bed placement */}
      {isMobile && activeNav === 'garden' && !pendingPlantId && (
        <button
          onClick={() => handleSelectForPlacement('raised-bed', true)}
          className="fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center text-2xl lg:hidden hover:bg-primary/90 transition-colors"
          title="Add a bed"
        >
          +
        </button>
      )}

      {/* Modals (lazy-loaded with Suspense) */}
      <ModalContainer
        {...{
          showCalendar, setShowCalendar,
          showAI, setShowAI,
          showAuth, setShowAuth,
          showSaveLoad, setShowSaveLoad,
          showRotation, setShowRotation,
          showWeather, setShowWeather,
          showWatering, setShowWatering,
          showPlotMap, setShowPlotMap,
          showJournal, setShowJournal,
          showDocs, setShowDocs,
          showSeedInventory, setShowSeedInventory,
          showPlantingSuggestions, setShowPlantingSuggestions,
          showTasks, setShowTasks,
          showMonthlyPlanner, setShowMonthlyPlanner,
          showGrowGuide, setShowGrowGuide,
          showShoppingList, setShowShoppingList,
          showHarvestLogger, setShowHarvestLogger,
          showPestLog, setShowPestLog,
          showRotationPlanner, setShowRotationPlanner,
          showClearConfirm, setShowClearConfirm,
        }}
        placedPlants={placedPlants}
        placedStructures={placedStructures}
        settings={settings}
        location={location}
        currentPlanId={currentPlanId}
        planName={planName}
        frostDates={frostDates}
        user={user}
        onLoadPlan={handleLoadPlan}
        onNewPlan={handleNewPlan}
        onOptimizeRotation={handleOptimizeRotation}
        onClearConfirm={confirmClear}
      />

      <ConflictDialog conflict={conflict} onResolve={handleConflictResolve} />

      {/* Alternative views for mobile navigation */}
      {isMobile && activeNav === 'crops' && (
        <div className="flex-1 overflow-y-auto pb-24 lg:hidden">
          <PlantSidebar
            onDragStart={setDragging}
            pendingPlantId={pendingPlantId}
            onSelectPlant={handleSelectForPlacement}
          />
        </div>
      )}

      {isMobile && activeNav === 'tasks' && (
        <div className="flex-1 overflow-y-auto pb-24 lg:hidden">
          <Suspense fallback={<div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" />Loading tasks…</div>}>
            <GardenTasks placedPlants={placedPlants} onClose={() => setActiveNav('garden')} inline={true} frostDates={frostDates} />
          </Suspense>
        </div>
      )}

      {isMobile && activeNav !== 'garden' && activeNav !== 'crops' && activeNav !== 'tasks' && (
        <div className="flex-1 overflow-y-auto pb-24">
          {activeNav === 'plan' && (
            <div className="p-4 space-y-3">
              <h2 className="text-2xl font-semibold text-foreground">📅 Plan</h2>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowCalendar(true)}
                  className="p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm font-medium flex flex-col items-center gap-1"
                >
                  <span className="text-lg">📅</span> Calendar
                </button>
                <button
                  onClick={() => setShowMonthlyPlanner(true)}
                  className="p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm font-medium flex flex-col items-center gap-1"
                >
                  <span className="text-lg">📆</span> Monthly
                </button>
                <button
                  onClick={() => setShowRotation(true)}
                  className="p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm font-medium flex flex-col items-center gap-1"
                >
                  <span className="text-lg">🔄</span> Rotation
                </button>
                <button
                  onClick={() => setShowPlotMap(true)}
                  className="p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm font-medium flex flex-col items-center gap-1"
                >
                  <span className="text-lg">🗺️</span> Plot Map
                </button>
                <button
                  onClick={() => setShowRotationPlanner(true)}
                  className="p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm font-medium flex flex-col items-center gap-1"
                >
                  <span className="text-lg">🔄</span> Planner
                </button>
                <button
                  onClick={() => setShowShoppingList(true)}
                  className="p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm font-medium flex flex-col items-center gap-1"
                >
                  <span className="text-lg">🛒</span> Shopping
                </button>
              </div>
            </div>
          )}
          {activeNav === 'more' && (
            <div className="p-4 space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">⚙️ More</h2>

              {/* Grow */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Grow</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setShowGrowGuide(true)}
                    className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
                  >
                    ✨ Grow Guide
                  </button>
                  <button
                    onClick={() => setShowAI(true)}
                    className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
                  >
                    🤖 AI Assistant
                  </button>
                  <button
                    onClick={() => setShowPlantingSuggestions(true)}
                    className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
                  >
                    💡 Suggestions
                  </button>
                  <button
                    onClick={() => setShowWeather(true)}
                    className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
                  >
                    🌤️ Weather & Yield
                  </button>
                  <button
                    onClick={() => setShowWatering(true)}
                    className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
                  >
                    💧 Watering Guide
                  </button>
                </div>
              </div>

              {/* Track */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Track</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setShowJournal(true)}
                    className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
                  >
                    📔 Garden Journal
                  </button>
                  <button
                    onClick={() => setShowSeedInventory(true)}
                    className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
                  >
                    📦 Seed Inventory
                  </button>
                  <button
                    onClick={() => setShowHarvestLogger(true)}
                    className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
                  >
                    🌾 Harvest Log
                  </button>
                  <button
                    onClick={() => setShowPestLog(true)}
                    className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
                  >
                    🐛 Pest & Disease Log
                  </button>
                </div>
              </div>

              {/* Plan */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Plan</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setShowCalendar(true)}
                    className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
                  >
                    📅 Planting Calendar
                  </button>
                  <button
                    onClick={() => setShowMonthlyPlanner(true)}
                    className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
                  >
                    📆 Monthly Planner
                  </button>
                  <button
                    onClick={() => setShowRotation(true)}
                    className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
                  >
                    🔄 Crop Rotation
                  </button>
                  <button
                    onClick={() => setShowRotationPlanner(true)}
                    className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
                  >
                    🔄 Rotation Planner
                  </button>
                  <button
                    onClick={() => setShowPlotMap(true)}
                    className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
                  >
                    🗺️ Plot Map
                  </button>
                  <button
                    onClick={() => setShowShoppingList(true)}
                    className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
                  >
                    🛒 Shopping List
                  </button>
                </div>
              </div>

              {/* Settings */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Settings</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setShowDocs(true)}
                    className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
                  >
                    📚 Guide & Docs
                  </button>
                  <button
                    onClick={() => handleExportPDF()}
                    className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
                  >
                    📥 Export PDF
                  </button>
                  {user && (
                    <button
                      onClick={() => setShowSaveLoad(true)}
                      className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
                    >
                      📁 My Gardens
                    </button>
                  )}
                  {!user && (
                    <button
                      onClick={() => setShowAuth(true)}
                      className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
                    >
                      👤 Sign In
                    </button>
                  )}
                  {user && (
                    <button
                      onClick={() => signOut()}
                      className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
                    >
                      🚪 Sign Out
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom navigation bar for mobile */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-area-inset-bottom">
          <BottomNavBar
            active={activeNav}
            onNavigate={setActiveNav}
          />
        </div>
      )}

      <SyncStatusBar />
    </div>
  );
};

export default Index;
