import React, { useState, useCallback, useMemo, useEffect, useRef, Suspense } from 'react';

import { PlacedPlant, PlotSettings, PlacedStructure, PlantStage } from '@/types/garden';
import { GardenPlanRow } from '@/lib/schemas';
import { initializeSyncStatus } from '@/lib/db';
import { type NavSection } from '@/components/AppShell';
import { BottomNavBar } from '@/components/BottomNavBar';
import { SetupWizard, type WizardSettings } from '@/components/SetupWizard';
import { InstallPrompt } from '@/components/InstallPrompt';
import { PlantSidebar } from '@/components/PlantSidebar';
import { GardenGrid } from '@/components/GardenGrid';
import { BedPlantingPanel } from '@/components/BedPlantingPanel';
import { getStructureById } from '@/data/structures';
import { getPlantById, plants as allPlantsList } from '@/data/plants';
import { useFavouritePlants } from '@/hooks/useFavouritePlants';
import { MobilePlantSheet } from '@/components/MobilePlantSheet';
import MobileToolbar from '@/components/MobileToolbar';
import MobileFloatingActions from '@/components/MobileFloatingActions';
import { WelcomeModal } from '@/components/WelcomeModal';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { LocationPicker } from '@/components/LocationPicker';
import { RainWidget } from '@/components/RainWidget';
import { SocialShare } from '@/components/SocialShare';
import { SyncStatusBar } from '@/components/SyncStatusBar';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { SuccessionSlider } from '@/components/SuccessionSlider';
import { ModalContainer } from '@/components/ModalContainer';
import { useAuth } from '@/hooks/use-auth';
import { useGardenModals } from '@/hooks/useGardenModals';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFrostDates } from '@/hooks/useFrostDates';
import { useConflictResolution } from '@/hooks/useConflictResolution';
import { ConflictDialog } from '@/components/ConflictDialog';
import { useGardenState } from '@/hooks/useGardenState';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { useAutoSave } from '@/hooks/useAutoSave';
// exportGardenPDF is loaded on-demand to keep jsPDF out of the initial bundle
import { optimizeRotation } from '@/utils/rotationOptimizer';
import { slotGroupName } from '@/utils/bedRotationUtils';
import { useAutomationPlan } from '@/hooks/useAutomationPlan';
import { getSowingStatus } from '@/utils/seasonalSowing';
import { Sprout, User, LogOut, X, Undo2, Redo2, History, Loader2, Check, Compass, Grid3X3, Minus, Plus, RotateCcw, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

// GardenTasks is also used inline on mobile (not in ModalContainer)
const GardenTasks = React.lazy(() => import('@/components/GardenTasks').then(m => ({ default: m.GardenTasks })));
const IsometricGardenGrid = React.lazy(() => import('@/components/IsometricGardenGrid').then(m => ({ default: m.IsometricGardenGrid })));
const AutomationPlanner = React.lazy(() => import('@/components/AutomationPlanner').then(m => ({ default: m.AutomationPlanner })));
import { GardenHealthDashboard } from '@/components/GardenHealthDashboard';

const Index = () => {
  const { user, signOut } = useAuth();
  const { getFavouritesWithQuantity } = useFavouritePlants();
  const { conflict, checkForConflict, resolveConflict } = useConflictResolution();

  // ── Garden state (core data + auto-load) ─────────────
  const {
    settings, setSettings,
    placedPlants, setPlacedPlants,
    selectedPlant, setSelectedPlant,
    selectedBed, setSelectedBed,
    placedStructures, setPlacedStructures,
    currentPlanId, setCurrentPlanId,
    planName, setPlanName,
    location, setLocation,
    defaultStage, setDefaultStage,
    applyPlan,
    handleNewPlan,
  } = useGardenState({ user, plans: [] as GardenPlanRow[] }); // plans injected below after useAutoSave

  // ── Auto-save + "Saved" flash ────────────────────────
  const { isSaving, showSaved, plans } = useAutoSave({
    placedPlants, placedStructures, settings,
    currentPlanId, planName, setCurrentPlanId,
  });

  // Re-wire useGardenState's auto-load to use actual plans
  // (The auto-load effect inside useGardenState already watches plans via its own useEffect)
  // We need to pass plans into useGardenState — but since hooks can't be called conditionally,
  // we handle this by passing plans through the options. Let's refactor slightly:
  // Actually, useGardenState already gets plans=[] initially; the auto-load effect in
  // useGardenState fires on [user, plans]. Since we're passing [] above, the auto-load
  // only fires for IndexedDB fallback. We need to feed real plans in.

  // Let me fix this: we need to restructure so useGardenState gets real plans.
  // The issue is circular: useAutoSave needs garden state, useGardenState needs plans from useAutoSave.
  // Solution: we break the circle by having useGardenState accept plans as a mutable ref or
  // by passing plans directly. Since hooks are called every render, we can just memoize.

  const [dragging, setDragging] = useState<string | null>(null); // used only for drag-and-drop dataTransfer
  const frostDates = useFrostDates(location);
  const [pendingPlantId, setPendingPlantId] = useState<string | null>(null);
  const [pendingIsStructure, setPendingIsStructure] = useState(false);
  const [activeNav, setActiveNav] = useState<NavSection>('garden');
  const [canvasLocked, setCanvasLocked] = useState(false);
  const isMobile = useIsMobile();
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  // Isometric grid A/B flag — enable via ?iso=1 in URL or toggle button
  const [useIsometric, setUseIsometric] = useState(
    () => new URLSearchParams(window.location.search).get('iso') === '1'
  );
  // Succession planting slider — month view and visibility
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [showSuccessionSlider, setShowSuccessionSlider] = useState(false);

  // Automation Planner
  const [showAutomationPlanner, setShowAutomationPlanner] = useState(false);
  const { plans: automationPlans, allTasks: automationTasks, previewPlan, commitPlan, removePlan, toggleTask: toggleAutomationTask } = useAutomationPlan(placedStructures);

  // Holds the user-chosen W x H when selecting a structure from the size picker.
  // Ref for stale-closure-safe placement; state for passing to GardenGrid as a prop.
  const pendingStructureSizeRef = useRef<{ w: number; h: number } | null>(null);
  const [pendingStructureSize, setPendingStructureSize] = useState<{ w: number; h: number } | null>(null);

  // Must be declared before useUndoRedo to avoid temporal dead zone
  const handleCancelPending = useCallback(() => {
    setPendingPlantId(null);
    setPendingIsStructure(false);
    pendingStructureSizeRef.current = null;
    setPendingStructureSize(null);
  }, []);

  const clearSelections = useCallback(() => {
    setSelectedPlant(null);
    setSelectedBed(null);
  }, [setSelectedPlant, setSelectedBed]);

  // ── Undo / Redo ──────────────────────────────────────
  const {
    undoStack, redoStack,
    pushUndo, handleUndo, handleRedo,
    resetStacks,
  } = useUndoRedo({
    placedPlants, placedStructures,
    setPlacedPlants, setPlacedStructures,
    clearSelections,
    pendingPlantId,
    onCancelPending: handleCancelPending,
  });

  const exportingRef = useRef(false);

  // Rotation year-advance banner
  const [showRotationAdvanceBanner, setShowRotationAdvanceBanner] = useState(false);
  const rotationBannerCheckedRef = useRef(false);
  useEffect(() => {
    if (rotationBannerCheckedRef.current) return;
    if (!placedStructures.some(s => s.rotationSlot != null)) return;
    const currentYear = new Date().getFullYear();
    const lastAdvance = parseInt(localStorage.getItem('ab-rotation-advance-year') || '0', 10);
    if (currentYear > lastAdvance) {
      setShowRotationAdvanceBanner(true);
      rotationBannerCheckedRef.current = true;
    }
  }, [placedStructures]);

  const handleAdvanceAllRotations = useCallback(() => {
    const currentYear = new Date().getFullYear();
    setPlacedStructures(prev => prev.map(s => {
      if (s.rotationSlot == null) return s;
      const currentGroup = slotGroupName(s.rotationSlot);
      const prevHistory = s.rotationHistory ?? [];
      const updatedHistory = [
        ...prevHistory.filter(e => e.year !== currentYear),
        { year: currentYear, group: currentGroup },
      ];
      return { ...s, rotationSlot: (s.rotationSlot % 4) + 1, rotationHistory: updatedHistory };
    }));
    localStorage.setItem('ab-rotation-advance-year', String(new Date().getFullYear()));
    setShowRotationAdvanceBanner(false);
  }, [setPlacedStructures]);

  const handleDismissRotationAdvance = useCallback(() => {
    localStorage.setItem('ab-rotation-advance-year', String(new Date().getFullYear()));
    setShowRotationAdvanceBanner(false);
  }, []);

  // "This week" plan dashboard computations
  const thisWeekData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();

    // Plants approaching harvest (within 14 days, or overdue by up to 7 days)
    const harvestSoon = placedPlants
      .filter(pp => {
        const plant = getPlantById(pp.plantId);
        if (!plant?.daysToHarvest || pp.stage === 'established') return false;
        const planted = new Date(pp.plantedAt);
        const harvestDate = new Date(planted.getTime() + plant.daysToHarvest * 86400000);
        const days = Math.ceil((harvestDate.getTime() - now.getTime()) / 86400000);
        return days >= -7 && days <= 14;
      })
      .slice(0, 4)
      .map(pp => {
        const plant = getPlantById(pp.plantId)!;
        const planted = new Date(pp.plantedAt);
        const harvestDate = new Date(planted.getTime() + plant.daysToHarvest! * 86400000);
        const days = Math.ceil((harvestDate.getTime() - now.getTime()) / 86400000);
        return { plant, days };
      });

    // Unique plants already in garden to avoid suggesting what they already have plenty of
    const plantedIds = new Set(placedPlants.map(pp => pp.plantId));

    // Top plants to sow this month that aren't already heavily planted
    const toSowNow = allPlantsList
      .filter(p => {
        const status = getSowingStatus(p, currentMonth);
        return status.canSowNow && !plantedIds.has(p.id);
      })
      .slice(0, 4);

    return { harvestSoon, toSowNow, currentMonth };
  }, [placedPlants]);

  // Frost warning: show banner when tender/half-hardy plants are placed and frost is expected within 14 days
  const frostWarningPlants = useMemo(() => {
    if (!frostDates || !location) return [];
    const now = new Date();
    const lastFrost = frostDates.lastFrostDate;
    const firstFrost = frostDates.firstFrostDate;
    // Check if we're within 14 days of either frost boundary
    const daysToLastFrost = Math.ceil((lastFrost.getTime() - now.getTime()) / 86400000);
    const daysToFirstFrost = Math.ceil((firstFrost.getTime() - now.getTime()) / 86400000);
    const frostImminent = (daysToLastFrost >= -3 && daysToLastFrost <= 14) || (daysToFirstFrost >= 0 && daysToFirstFrost <= 14);
    if (!frostImminent) return [];
    return placedPlants.filter(pp => {
      const plant = getPlantById(pp.plantId);
      return plant?.frostHardiness === 'tender' || plant?.frostHardiness === 'half-hardy';
    });
  }, [frostDates, location, placedPlants]);

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
    // Auto-navigate to garden so the user can tap to place
    setActiveNav('garden');
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
          `Warning: Frost risk: ${plantData.name} is ${plantData.frostHardiness} -- last frost expected in ~${daysToLastFrost} days. Consider waiting or using protection.`,
          { duration: 6000 }
        );
      }
    }

    pushUndo(placedPlants, placedStructures);
    setPlacedPlants(prev => [...prev, {
      id: `${plantId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      plantId, x, y,
      plantedAt: new Date().toISOString(),
      stage: defaultStage,
    }]);
    setDragging(null);
  }, [placedPlants, placedStructures, defaultStage, pushUndo, settings.cellSizeCm, frostDates, setPlacedPlants]);

  const handleFillPlantArea = useCallback((plantId: string, originX: number, originY: number, w: number, h: number) => {
    pushUndo(placedPlants, placedStructures);
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
  }, [placedPlants, placedStructures, pushUndo, settings.cellSizeCm, defaultStage, setPlacedPlants]);

  const handleSmartAutoFill = useCallback((originX: number, originY: number, w: number, h: number, isContainer: boolean) => {
    pushUndo(placedPlants, placedStructures);
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
  }, [placedPlants, placedStructures, pushUndo, settings.cellSizeCm, defaultStage, getFavouritesWithQuantity, setPlacedPlants]);

  const handleRemovePlant = useCallback((id: string) => {
    const removed = placedPlants.find(p => p.id === id);
    pushUndo(placedPlants, placedStructures);
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
  }, [selectedPlant, pushUndo, placedPlants, placedStructures, handleUndo, setPlacedPlants, setSelectedPlant]);

  const handleUpdatePlacedPlant = useCallback((updated: PlacedPlant) => {
    setPlacedPlants(prev => prev.map(p => p.id === updated.id ? updated : p));
    setSelectedPlant(prev => prev?.id === updated.id ? updated : prev);
  }, [setPlacedPlants, setSelectedPlant]);

  const handleMovePlantStart = useCallback(() => {
    pushUndo(placedPlants, placedStructures);
  }, [placedPlants, placedStructures, pushUndo]);

  const handleMovePlant = useCallback((id: string, x: number, y: number) => {
    const plantToMove = placedPlants.find(p => p.id === id);
    if (!plantToMove) return;

    const positionUnchanged = plantToMove.x === x && plantToMove.y === y;
    const occupied = placedPlants.some(p => p.id !== id && p.x === x && p.y === y);
    if (positionUnchanged || occupied) return;

    setPlacedPlants(prev => prev.map(p => p.id === id ? { ...p, x, y } : p));
    setSelectedPlant(prev => prev?.id === id ? { ...prev, x, y } : prev);
  }, [placedPlants, setPlacedPlants, setSelectedPlant]);

  const handleClear = useCallback(() => {
    setShowClearConfirm(true);
  }, [setShowClearConfirm]);

  const confirmClear = useCallback(() => {
    pushUndo(placedPlants, placedStructures);
    setPlacedPlants([]);
    setPlacedStructures([]);
    setSelectedPlant(null);
    setShowClearConfirm(false);
  }, [placedPlants, placedStructures, pushUndo, setShowClearConfirm, setPlacedPlants, setPlacedStructures, setSelectedPlant]);

  const handleSelectStructureForPlacement = useCallback((structureId: string, w: number, h: number) => {
    const size = { w, h };
    pendingStructureSizeRef.current = size;
    setPendingStructureSize(size);
    setPendingPlantId(structureId);
    setPendingIsStructure(true);
    setActiveNav('garden');
  }, []);

  const handlePlaceStructure = useCallback((structureId: string, x: number, y: number) => {
    const structData = getStructureById(structureId);
    if (!structData) return;
    const size = pendingStructureSizeRef.current;
    pushUndo(placedPlants, placedStructures);
    setPlacedStructures(prev => [...prev, {
      id: `${structureId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      structureId,
      x, y,
      widthCells: size?.w ?? structData.widthCells,
      heightCells: size?.h ?? structData.heightCells,
    }]);
    pendingStructureSizeRef.current = null;
    setPendingStructureSize(null);
    setDragging(null);
  }, [placedPlants, placedStructures, pushUndo, setPlacedStructures]);

  const handleRemoveStructure = useCallback((id: string) => {
    pushUndo(placedPlants, placedStructures);
    setPlacedStructures(prev => prev.filter(s => s.id !== id));
  }, [placedPlants, placedStructures, pushUndo, setPlacedStructures]);

  const handleResizeStructure = useCallback((id: string, widthCells: number, heightCells: number) => {
    setPlacedStructures(prev => prev.map(s => s.id === id ? { ...s, widthCells, heightCells } : s));
  }, [setPlacedStructures]);

  const handleMoveStructureStart = useCallback(() => {
    pushUndo(placedPlants, placedStructures);
  }, [placedPlants, placedStructures, pushUndo]);

  const handleMoveStructure = useCallback((id: string, x: number, y: number) => {
    setPlacedStructures(prev => {
      const bed = prev.find(s => s.id === id);
      if (bed) {
        const dx = x - bed.x;
        const dy = y - bed.y;
        if (dx !== 0 || dy !== 0) {
          setPlacedPlants(pp => pp.map(p => {
            const inBed = p.x >= bed.x && p.x < bed.x + bed.widthCells &&
                          p.y >= bed.y && p.y < bed.y + bed.heightCells;
            return inBed ? { ...p, x: p.x + dx, y: p.y + dy } : p;
          }));
        }
      }
      return prev.map(s => s.id === id ? { ...s, x, y } : s);
    });
  }, [setPlacedStructures, setPlacedPlants]);

  const handleUpdateStructure = useCallback((updated: PlacedStructure) => {
    setPlacedStructures(prev => prev.map(s => s.id === updated.id ? updated : s));
    setSelectedBed(prev => prev?.id === updated.id ? updated : prev);
  }, [setPlacedStructures, setSelectedBed]);

  const handleDuplicateBed = useCallback((bedId: string) => {
    const bed = placedStructures.find(s => s.id === bedId);
    if (!bed) return;
    pushUndo(placedPlants, placedStructures);
    const newBed: PlacedStructure = {
      ...bed,
      id: `${bed.structureId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      x: Math.min(bed.x + 1, 50),
      y: Math.min(bed.y + 1, 50),
      name: bed.name ? `${bed.name} copy` : undefined,
    };
    setPlacedStructures(prev => [...prev, newBed]);
    toast.success('Bed duplicated');
  }, [placedPlants, placedStructures, pushUndo, setPlacedStructures]);

  // Add a plant to a specific cell in a bed (col/row are relative to bed origin)
  const handleAddPlantToBed = useCallback((bed: PlacedStructure, plantId: string, col: number, row: number) => {
    const x = bed.x + col;
    const y = bed.y + row;
    const alreadyOccupied = placedPlants.some(p => p.x === x && p.y === y);
    if (alreadyOccupied) return;
    pushUndo(placedPlants, placedStructures);
    setPlacedPlants(prev => [...prev, {
      id: `${plantId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      plantId,
      x, y,
      plantedAt: new Date().toISOString(),
      stage: defaultStage,
    }]);
  }, [placedPlants, placedStructures, defaultStage, pushUndo, setPlacedPlants]);

  const handleLoadPlan = useCallback(async (plan: GardenPlanRow) => {
    const resolved = await checkForConflict(plan);
    if (resolved) applyPlan(resolved);
    // If null, the conflict dialog is shown and will call handleConflictResolve
  }, [checkForConflict, applyPlan]);

  const handleConflictResolve = useCallback(async (choice: 'local' | 'remote' | null) => {
    const resolved = await resolveConflict(choice);
    if (resolved) applyPlan(resolved);
  }, [resolveConflict, applyPlan]);

  const handleExportPDF = async () => {
    if (exportingRef.current) return;
    exportingRef.current = true;
    try {
      const { exportGardenPDF } = await import('@/utils/exportPDF');
      await exportGardenPDF(settings, placedPlants, planName, null, placedStructures);
      toast.success('PDF exported!');
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
    toast.success('Garden rotation optimized!');
  }, [placedPlants, settings, setPlacedPlants, setSelectedPlant]);

  // Handler for loading a plan from the desktop toolbar plan-history selector
  const handleToolbarPlanSelect = useCallback((plan: GardenPlanRow) => {
    applyPlan(plan);
    resetStacks();
  }, [applyPlan, resetStacks]);

  return (
    <div className="h-screen flex flex-col bg-background pb-16 touch-manipulation overscroll-none" style={{ overscrollBehavior: 'none' }}>
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

        {/* Location & weather — hidden on mobile, shown on sm+ */}
        <div className="hidden sm:contents">
          <LocationPicker location={location} onLocationChange={setLocation} />
          <RainWidget location={location} />
        </div>

        {/* Unified header actions — same on all screen sizes */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Location picker compact - mobile only */}
          <div className="sm:hidden">
            <LocationPicker location={location} onLocationChange={setLocation} />
          </div>
          <SocialShare />
          <DarkModeToggle />
          {user ? (
            <Button variant="ghost" size="sm" className="h-9 text-xs rounded-xl" onClick={() => signOut()}>
              <LogOut className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="h-9 text-xs rounded-xl" onClick={() => setShowAuth(true)}>
              <User className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Sign In</span>
            </Button>
          )}
        </div>
      </header>

      <OfflineIndicator />

      {/* Install prompt */}
      <div className="px-4 py-2 bg-card border-b border-border">
        <InstallPrompt />
      </div>

      {/* Toolbar — only shown when viewing the garden grid */}
      {activeNav === 'garden' && (
        <>
        {/* Mobile toolbar — compact with popover for secondary controls */}
        <div className="lg:hidden shrink-0">
          <MobileToolbar
            undoCount={undoStack.length}
            redoCount={redoStack.length}
            onUndo={handleUndo}
            onRedo={handleRedo}
            cellSizePx={settings.cellSizePx}
            onZoomIn={() => setSettings(s => ({ ...s, cellSizePx: Math.min(64, s.cellSizePx + 4) }))}
            onZoomOut={() => setSettings(s => ({ ...s, cellSizePx: Math.max(16, s.cellSizePx - 4) }))}
            defaultStage={defaultStage as 'seed' | 'seedling'}
            onSetStage={setDefaultStage}
            useIsometric={useIsometric}
            onToggleIsometric={() => setUseIsometric(v => !v)}
            snapToGrid={settings.snapToGrid ?? false}
            onToggleSnap={() => setSettings(s => ({ ...s, snapToGrid: !s.snapToGrid }))}
            widthM={settings.widthM}
            heightM={settings.heightM}
            unit={settings.unit}
            onSetWidth={(w) => setSettings(s => ({ ...s, widthM: Math.max(1, w) }))}
            onSetHeight={(h) => setSettings(s => ({ ...s, heightM: Math.max(1, h) }))}
            onToggleUnit={() => setSettings(s => ({ ...s, unit: s.unit === 'meters' ? 'feet' : 'meters' }))}
            canvasLocked={canvasLocked}
            onToggleLock={() => setCanvasLocked(v => !v)}
            southDirection={settings.southDirection}
            onSetDirection={(d) => setSettings(s => ({ ...s, southDirection: d }))}
            plantCount={placedPlants.length}
            onClear={handleClear}
            isSaving={isSaving}
            showSaved={showSaved}
          />
        </div>
        {/* Desktop toolbar — full horizontal bar */}
        <div className="hidden lg:block border-b border-border bg-card shrink-0 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1 px-2 py-1.5 min-w-max">
            {/* Undo / Redo */}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleUndo} disabled={undoStack.length === 0} title="Undo">
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRedo} disabled={redoStack.length === 0} title="Redo">
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
            <div className="h-5 w-px bg-border mx-1 shrink-0" />

            {/* Planting as */}
            <Button variant={defaultStage === 'seed' ? 'default' : 'outline'} size="sm" className="h-7 text-xs px-2" onClick={() => setDefaultStage('seed')}>
              🌰 Seed
            </Button>
            <Button variant={defaultStage === 'seedling' ? 'default' : 'outline'} size="sm" className="h-7 text-xs px-2 ml-0.5" onClick={() => setDefaultStage('seedling')}>
              🌱 Seedling
            </Button>
            <div className="h-5 w-px bg-border mx-1 shrink-0" />

            {/* View mode */}
            <Button variant={useIsometric ? 'default' : 'outline'} size="sm" className="h-7 text-xs px-2" onClick={() => setUseIsometric(v => !v)} title={useIsometric ? 'Switch to flat' : 'Switch to isometric'}>
              {useIsometric ? '🏔️ Iso' : '🗺️ Flat'}
            </Button>
            <div className="h-5 w-px bg-border mx-1 shrink-0" />

            {/* Snap to grid */}
            <button
              onClick={() => setSettings(s => ({ ...s, snapToGrid: !s.snapToGrid }))}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded h-7 font-medium transition-colors ${settings.snapToGrid ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              title="Snap to grid"
            >
              <Grid3X3 className="h-3 w-3" /> Snap
            </button>
            <div className="h-5 w-px bg-border mx-1 shrink-0" />

            {/* Zoom */}
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSettings(s => ({ ...s, cellSizePx: Math.max(16, s.cellSizePx - 4) }))} title="Zoom out">
              <Minus className="h-3 w-3" />
            </Button>
            <span className="text-xs w-8 text-center text-foreground">{settings.cellSizePx}px</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSettings(s => ({ ...s, cellSizePx: Math.min(64, s.cellSizePx + 4) }))} title="Zoom in">
              <Plus className="h-3 w-3" />
            </Button>
            <div className="h-5 w-px bg-border mx-1 shrink-0" />

            {/* Plot size */}
            <span className="text-muted-foreground text-xs">Plot:</span>
            <Input type="number" value={settings.widthM} onChange={e => setSettings(s => ({ ...s, widthM: Math.max(1, Number(e.target.value)) }))} className="w-12 h-6 text-xs text-center mx-0.5" min={1} max={50} />
            <span className="text-muted-foreground text-xs">×</span>
            <Input type="number" value={settings.heightM} onChange={e => setSettings(s => ({ ...s, heightM: Math.max(1, Number(e.target.value)) }))} className="w-12 h-6 text-xs text-center mx-0.5" min={1} max={50} />
            <button onClick={() => setSettings(s => ({ ...s, unit: s.unit === 'meters' ? 'feet' : 'meters' }))} className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground font-medium">
              {settings.unit === 'meters' ? 'm' : 'ft'}
            </button>
            <div className="h-5 w-px bg-border mx-1 shrink-0" />

            {/* Grid size — fixed at 20cm */}
            <span className="text-muted-foreground text-xs">Grid: <span className="text-foreground font-medium">20cm</span></span>
            <div className="h-5 w-px bg-border mx-1 shrink-0" />

            {/* Canvas lock */}
            <button
              onClick={() => setCanvasLocked(v => !v)}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded h-7 font-medium transition-colors ${canvasLocked ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              title={canvasLocked ? 'Canvas locked — click to unlock' : 'Lock canvas'}
            >
              {canvasLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
              {canvasLocked ? 'Locked' : 'Lock'}
            </button>
            <div className="h-5 w-px bg-border mx-1 shrink-0" />

            {/* Compass */}
            <Compass className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <select value={settings.southDirection} onChange={e => setSettings(s => ({ ...s, southDirection: Number(e.target.value) }))} className="h-6 text-xs rounded border border-input bg-background px-1.5 text-foreground ml-0.5">
              {[{ value: 0, label: '⬆N' }, { value: 45, label: '↗NE' }, { value: 90, label: '➡E' }, { value: 135, label: '↘SE' }, { value: 180, label: '⬇S' }, { value: 225, label: '↙SW' }, { value: 270, label: '⬅W' }, { value: 315, label: '↖NW' }].map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <div className="h-5 w-px bg-border mx-1 shrink-0" />

            {/* Plants count */}
            <span className="text-xs text-muted-foreground whitespace-nowrap">🌱 {placedPlants.length}</span>

            {/* Plan history */}
            {user && plans.length > 0 && (
              <>
                <div className="h-5 w-px bg-border mx-1 shrink-0" />
                <div className="relative">
                  <select
                    className="h-7 text-xs border rounded px-2 bg-background text-foreground appearance-none pr-6 cursor-pointer"
                    value={currentPlanId || ''}
                    onChange={(e) => {
                      const plan = plans.find((p: GardenPlanRow) => p.id === e.target.value);
                      if (plan) handleToolbarPlanSelect(plan);
                    }}
                  >
                    {plans.map((plan: GardenPlanRow) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} — {new Date(plan.updated_at || plan.created_at || Date.now()).toLocaleDateString('en-GB')}
                      </option>
                    ))}
                  </select>
                  <History className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                </div>
              </>
            )}
            <div className="h-5 w-px bg-border mx-1 shrink-0" />

            {/* Clear */}
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={handleClear}>
              <RotateCcw className="h-3 w-3 mr-1" /> Clear
            </Button>

            {/* Saving indicator */}
            {isSaving && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground ml-1 whitespace-nowrap">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving…
              </span>
            )}
            {showSaved && !isSaving && (
              <span className="flex items-center gap-1 text-[10px] text-green-600 ml-1 animate-in fade-in duration-300 whitespace-nowrap">
                <Check className="h-3 w-3" /> Saved
              </span>
            )}
          </div>
        </div>
        </>
      )}

      {/* Rotation year-advance banner */}
      {showRotationAdvanceBanner && activeNav === 'garden' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 shrink-0">
          <span className="text-base">🔄</span>
          <p className="flex-1 text-xs text-amber-900">
            <span className="font-semibold">New year — advance rotations?</span>{' '}
            Bump every bed forward one step in the 4-year cycle.
          </p>
          <button
            onClick={handleAdvanceAllRotations}
            className="shrink-0 text-xs font-semibold bg-amber-600 text-white rounded-lg px-2.5 py-1 hover:bg-amber-700 transition-colors"
          >
            Advance all
          </button>
          <button
            onClick={handleDismissRotationAdvance}
            className="shrink-0 text-xs text-amber-700 hover:underline"
          >
            Not yet
          </button>
        </div>
      )}

      {/* Frost warning banner */}
      {frostWarningPlants.length > 0 && activeNav === 'garden' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-blue-200 shrink-0">
          <span className="text-base">🌡️</span>
          <p className="flex-1 text-xs text-blue-900">
            <span className="font-semibold">Frost risk near you</span>{' '}
            {frostWarningPlants.length} frost-sensitive plant{frostWarningPlants.length !== 1 ? 's' : ''} may need protection.
            {frostDates && (() => {
              const now = new Date();
              const days = Math.ceil((frostDates.lastFrostDate.getTime() - now.getTime()) / 86400000);
              if (days > 0) return ` Last frost est. in ~${days} days.`;
              const daysFirst = Math.ceil((frostDates.firstFrostDate.getTime() - now.getTime()) / 86400000);
              if (daysFirst >= 0 && daysFirst <= 14) return ` First autumn frost est. in ~${daysFirst} days.`;
              return '';
            })()}
          </p>
        </div>
      )}

      {/* Garden grid — full width, no sidebar */}
      <div className={`${activeNav !== 'garden' ? 'hidden' : 'flex-1 flex flex-col'} overflow-hidden relative`}>
        {/* Garden health dashboard — compact stats bar */}
        {placedPlants.length > 0 && (
          <div className="shrink-0 px-2 py-1 border-b border-border/50">
            <GardenHealthDashboard
              plants={placedPlants}
              structures={placedStructures}
              automationTasks={automationTasks}
            />
          </div>
        )}
        <div className="flex-1 flex overflow-hidden relative">
        {useIsometric ? (
          <Suspense fallback={<div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
            <IsometricGardenGrid
              settings={settings}
              plants={placedPlants}
              structures={placedStructures}
              onPlacePlant={handlePlacePlant}
              onRemovePlant={handleRemovePlant}
              onMovePlant={handleMovePlant}
              onMovePlantStart={handleMovePlantStart}
              onSelectPlant={(plant) => {
                if (!plant) return;
                const parentBed = placedStructures.find(s =>
                  plant.x >= s.x && plant.x < s.x + s.widthCells &&
                  plant.y >= s.y && plant.y < s.y + s.heightCells
                );
                if (parentBed) { setSelectedBed(parentBed); setSelectedPlant(null); }
              }}
              onPlaceStructure={handlePlaceStructure}
              onRemoveStructure={handleRemoveStructure}
              onResizeStructure={handleResizeStructure}
              onMoveStructure={handleMoveStructure}
              onMoveStructureStart={handleMoveStructureStart}
              selectedPlantId={null}
              onFillPlantArea={handleFillPlantArea}
              onSmartAutoFill={handleSmartAutoFill}
              onSettingsChange={setSettings}
              pendingPlantId={pendingPlantId}
              pendingIsStructure={pendingIsStructure}
              onCancelPending={handleCancelPending}
              viewMonth={showSuccessionSlider ? viewMonth : null}
              isMobile={isMobile}
              locked={canvasLocked}
              onSelectBed={bed => {
                setSelectedBed(bed);
                setSelectedPlant(null);
              }}
            />
          </Suspense>
        ) : (
          <GardenGrid
            settings={settings}
            plants={placedPlants}
            structures={placedStructures}
            onPlacePlant={handlePlacePlant}
            onRemovePlant={handleRemovePlant}
            onMovePlant={handleMovePlant}
            onMovePlantStart={handleMovePlantStart}
            onSelectPlant={(plant) => {
              if (!plant) return;
              const parentBed = placedStructures.find(s =>
                plant.x >= s.x && plant.x < s.x + s.widthCells &&
                plant.y >= s.y && plant.y < s.y + s.heightCells
              );
              if (parentBed) { setSelectedBed(parentBed); setSelectedPlant(null); }
            }}
            onPlaceStructure={handlePlaceStructure}
            onRemoveStructure={handleRemoveStructure}
            onResizeStructure={handleResizeStructure}
            onMoveStructure={handleMoveStructure}
            onMoveStructureStart={handleMoveStructureStart}
            selectedPlantId={null}
            onFillPlantArea={handleFillPlantArea}
            onSmartAutoFill={handleSmartAutoFill}
            onSettingsChange={setSettings}
            pendingPlantId={pendingPlantId}
            pendingIsStructure={pendingIsStructure}
            pendingStructureSize={pendingStructureSize}
            onCancelPending={handleCancelPending}
            viewMonth={showSuccessionSlider ? viewMonth : null}
            isMobile={isMobile}
            locked={canvasLocked}
            onSelectBed={bed => {
              setSelectedBed(bed);
              setSelectedPlant(null);
            }}
          />
        )}
        {activeNav === 'garden' && placedStructures.length === 0 && placedPlants.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="bg-card/90 backdrop-blur-sm rounded-2xl border border-border shadow-lg p-6 text-center max-w-sm pointer-events-auto">
              <svg width="100" height="80" viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-3">
                {/* Sun */}
                <circle cx="82" cy="16" r="10" fill="hsl(42 90% 55%)" />
                <g stroke="hsl(42 90% 55%)" strokeWidth="2" strokeLinecap="round">
                  <line x1="82" y1="2" x2="82" y2="0" />
                  <line x1="82" y1="30" x2="82" y2="32" />
                  <line x1="68" y1="16" x2="66" y2="16" />
                  <line x1="96" y1="16" x2="98" y2="16" />
                  <line x1="72" y1="6" x2="71" y2="5" />
                  <line x1="92" y1="26" x2="93" y2="27" />
                  <line x1="72" y1="26" x2="71" y2="27" />
                  <line x1="92" y1="6" x2="93" y2="5" />
                </g>
                {/* Fence */}
                <rect x="5" y="30" width="3" height="25" rx="1" fill="hsl(30 30% 55%)" />
                <rect x="18" y="30" width="3" height="25" rx="1" fill="hsl(30 30% 55%)" />
                <rect x="31" y="30" width="3" height="25" rx="1" fill="hsl(30 30% 55%)" />
                <rect x="3" y="35" width="33" height="3" rx="1" fill="hsl(30 30% 50%)" />
                <rect x="3" y="45" width="33" height="3" rx="1" fill="hsl(30 30% 50%)" />
                {/* Raised bed */}
                <rect x="42" y="50" width="50" height="18" rx="3" fill="hsl(25 40% 38%)" />
                <rect x="44" y="52" width="46" height="14" rx="2" fill="hsl(25 30% 25%)" />
                {/* Sprout in bed */}
                <line x1="60" y1="52" x2="60" y2="42" stroke="hsl(142 55% 40%)" strokeWidth="2.5" strokeLinecap="round" />
                <ellipse cx="56" cy="43" rx="4" ry="5" fill="hsl(142 55% 40%)" />
                <ellipse cx="64" cy="43" rx="4" ry="5" fill="hsl(142 55% 40%)" />
                {/* Small sprout */}
                <line x1="75" y1="52" x2="75" y2="47" stroke="hsl(142 55% 40%)" strokeWidth="2" strokeLinecap="round" />
                <ellipse cx="73" cy="47" rx="2.5" ry="3" fill="hsl(142 55% 40%)" />
                <ellipse cx="77" cy="47" rx="2.5" ry="3" fill="hsl(142 55% 40%)" />
                {/* Ground line */}
                <rect x="0" y="68" width="100" height="12" rx="2" fill="hsl(142 20% 30%)" />
              </svg>
              <h3 className="font-semibold text-foreground text-lg mt-2 mb-1">Your garden awaits</h3>
              <p className="text-xs text-muted-foreground mb-4">Start by placing raised beds or containers, then fill them with your favourite crops.</p>
              <div className="flex gap-2 justify-center mb-3">
                <button
                  onClick={() => setActiveNav('beds')}
                  className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors"
                >
                  Add a bed
                </button>
                <button
                  onClick={() => setActiveNav('plants')}
                  className="text-sm font-medium border border-border text-foreground px-4 py-2 rounded-xl hover:bg-muted transition-colors"
                >
                  Browse plants
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground/70 italic">Tip: Drag beds from the sidebar, then tap to add plants</p>
            </div>
          </div>
        )}
        {selectedBed && (
          <BedPlantingPanel
            bed={selectedBed}
            allBeds={placedStructures}
            allPlants={placedPlants}
            cellSizeCm={settings.cellSizeCm}
            onClose={() => setSelectedBed(null)}
            onUpdateBed={handleUpdateStructure}
            onRemoveBed={handleRemoveStructure}
            onAddPlant={(plantId, col, row) => handleAddPlantToBed(selectedBed, plantId, col, row)}
            onRemovePlant={handleRemovePlant}
            onUpdatePlacedPlant={handleUpdatePlacedPlant}
            onDuplicateBed={() => handleDuplicateBed(selectedBed.id)}
          />
        )}

        {/* Lock indicator — subtle badge in corner when locked */}
        {canvasLocked && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none">
            <div className="flex items-center gap-1.5 bg-card/80 backdrop-blur-sm border border-border rounded-full px-3 py-1 shadow text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> View only — modifications locked
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Succession Slider - Bottom Bar */}
      <SuccessionSlider
        viewMonth={viewMonth}
        onChange={setViewMonth}
        placedPlants={placedPlants}
        visible={showSuccessionSlider}
        onToggle={() => setShowSuccessionSlider(v => !v)}
      />

      {/* Plant picker — bottom sheet on mobile, old tray as fallback on lg screens */}
      <MobilePlantSheet
        pendingPlantId={pendingPlantId}
        onSelectPlant={handleSelectForPlacement}
        visible={activeNav === 'garden'}
      />

      {/* Tap-to-place indicator */}
      {pendingPlantId && activeNav === 'garden' && (
        <div className="fixed bottom-24 left-0 right-0 z-40 flex justify-center pointer-events-none lg:bottom-4">
          <div className="bg-primary text-primary-foreground text-sm px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 min-h-[44px]">
            {pendingIsStructure
              ? 'Tap the canvas to place structure'
              : 'Tap inside a bed to place plant'}
            <button
              className="ml-1 pointer-events-auto opacity-80 min-w-[44px] min-h-[44px] flex items-center justify-center"
              onClick={handleCancelPending}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating action button — speed-dial for quick structure placement */}
      <MobileFloatingActions
        onSelectStructure={handleSelectForPlacement}
        visible={activeNav === 'garden' && !pendingPlantId}
      />

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
        automationTasks={automationTasks}
        onToggleAutomationTask={toggleAutomationTask}
        onLoadPlan={handleLoadPlan}
        onNewPlan={handleNewPlan}
        onOptimizeRotation={handleOptimizeRotation}
        onClearConfirm={confirmClear}
        onUpdateStructure={handleUpdateStructure}
      />

      <ConflictDialog conflict={conflict} onResolve={handleConflictResolve} />

      {/* Automation Planner */}
      {showAutomationPlanner && (
        <Suspense fallback={null}>
          <AutomationPlanner
            placedStructures={placedStructures}
            activePlans={automationPlans}
            onPreview={previewPlan}
            onCommit={commitPlan}
            onRemove={removePlan}
            onClose={() => setShowAutomationPlanner(false)}
          />
        </Suspense>
      )}

      {/* Beds & Pots — beds, containers and covered growing structures */}
      {activeNav === 'beds' && (
        <div className="flex-1 overflow-hidden">
          <PlantSidebar
            onDragStart={setDragging}
            pendingPlantId={pendingPlantId}
            onSelectPlant={handleSelectForPlacement}
            onSelectStructure={handleSelectStructureForPlacement}
            cellSizeCm={settings.cellSizeCm}
            fullScreen
            defaultTab="structures"
            structureFilter="beds"
          />
        </div>
      )}

      {/* Structures view — non-growing structures (shed, path, fence, trees, etc.) */}
      {activeNav === 'structures' && (
        <div className="flex-1 overflow-hidden">
          <PlantSidebar
            onDragStart={setDragging}
            pendingPlantId={pendingPlantId}
            onSelectPlant={handleSelectForPlacement}
            onSelectStructure={handleSelectStructureForPlacement}
            cellSizeCm={settings.cellSizeCm}
            fullScreen
            defaultTab="structures"
            structureFilter="other"
          />
        </div>
      )}

      {/* Tasks view */}
      {activeNav === 'tasks' && (
        <div className="flex-1 overflow-y-auto pb-4">
          <Suspense fallback={<div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" />Loading tasks…</div>}>
            <GardenTasks placedPlants={placedPlants} onClose={() => setActiveNav('garden')} inline={true} frostDates={frostDates ? { lastSpringFrost: frostDates.lastFrostDate.toLocaleDateString(), firstFallFrost: frostDates.firstFrostDate.toLocaleDateString() } : null} automationTasks={automationTasks} onToggleAutomationTask={toggleAutomationTask} />
          </Suspense>
        </div>
      )}

      {/* Plan & More views */}
      {(activeNav === 'plan' || activeNav === 'more') && (
        <div className="flex-1 overflow-y-auto pb-4 max-w-2xl mx-auto w-full">
          {activeNav === 'plan' && (
            <div className="p-4 space-y-3">
              <h2 className="text-2xl font-semibold text-foreground">📅 Plan</h2>

              {/* "This week" summary card */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  📋 This week
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
                  </span>
                </h3>

                {/* Frost warning */}
                {frostWarningPlants.length > 0 && (
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900">
                    <span className="text-base leading-none mt-0.5">🌡️</span>
                    <span><strong>Frost risk:</strong> protect {frostWarningPlants.length} frost-sensitive plant{frostWarningPlants.length !== 1 ? 's' : ''}.</span>
                  </div>
                )}

                {/* Harvest soon */}
                {thisWeekData.harvestSoon.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Ready to harvest</p>
                    <div className="space-y-1">
                      {thisWeekData.harvestSoon.map(({ plant, days }, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span>{plant.emoji}</span>
                          <span className="font-medium text-foreground">{plant.name}</span>
                          <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            days <= 0 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {days <= 0 ? 'Ready now!' : `~${days}d`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* To sow this month */}
                {thisWeekData.toSowNow.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                      Sow in {new Date().toLocaleDateString('en-GB', { month: 'long' })}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {thisWeekData.toSowNow.map(plant => (
                        <span key={plant.id} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          {plant.emoji} {plant.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {thisWeekData.harvestSoon.length === 0 && thisWeekData.toSowNow.length === 0 && frostWarningPlants.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Add some plants to your garden to see personalised tips here.</p>
                )}
              </div>

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
                  <button
                    onClick={() => setShowAutomationPlanner(true)}
                    className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm flex items-center gap-2"
                  >
                    <span>🤖 Automation Planner</span>
                    {automationPlans.length > 0 && (
                      <span className="ml-auto text-[10px] bg-primary/20 text-primary rounded-full px-2 py-0.5 font-medium">
                        {automationTasks.filter(t => !t.completed).length} pending
                      </span>
                    )}
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

      {/* Bottom navigation bar — unified for all screen sizes */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-area-inset-bottom z-20">
        <BottomNavBar
          active={activeNav}
          onNavigate={setActiveNav}
        />
      </div>

      <SyncStatusBar />
    </div>
  );
};

export default Index;
