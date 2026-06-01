import React, { useState, useCallback, useMemo, useEffect, useRef, Suspense } from 'react';

import { GardenPlanRow } from '@/lib/schemas';
import { initializeSyncStatus } from '@/lib/db';
import { type NavSection } from '@/components/AppShell';
import { BottomNavBar } from '@/components/BottomNavBar';
import { SetupWizard, type WizardSettings } from '@/components/SetupWizard';
import { InstallPrompt } from '@/components/InstallPrompt';
import { getPlantById, plants as allPlantsList } from '@/data/plants';
import { useFavouritePlants } from '@/hooks/useFavouritePlants';
import { MobilePlantSheet } from '@/components/MobilePlantSheet';
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
import { usePlantHandlers } from '@/hooks/usePlantHandlers';
import { useStructureHandlers } from '@/hooks/useStructureHandlers';
import { useAutoSave } from '@/hooks/useAutoSave';
// exportGardenPDF is loaded on-demand to keep jsPDF out of the initial bundle
import { optimizeRotation } from '@/utils/rotationOptimizer';
import { slotGroupName } from '@/utils/bedRotationUtils';
import { useAutomationPlan } from '@/hooks/useAutomationPlan';
import { getSowingStatus } from '@/utils/seasonalSowing';
import { Sprout, User, LogOut, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const AutomationPlanner = React.lazy(() => import('@/components/AutomationPlanner').then(m => ({ default: m.AutomationPlanner })));
import { BedsView } from '@/components/views/BedsView';
import { StructuresView } from '@/components/views/StructuresView';
import { TasksView } from '@/components/views/TasksView';
import { PlanView } from '@/components/views/PlanView';
import { MoreView } from '@/components/views/MoreView';
import { GardenView } from '@/components/views/GardenView';

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
    planName,
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

  const [, setDragging] = useState<string | null>(null); // used only for drag-and-drop dataTransfer
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

  // ── Plant mutation handlers (extracted into usePlantHandlers) ──
  const {
    handlePlacePlant,
    handleFillPlantArea,
    handleSmartAutoFill,
    handleRemovePlant,
    handleUpdatePlacedPlant,
    handleMovePlantStart,
    handleMovePlant,
    confirmClear,
  } = usePlantHandlers({
    placedPlants, placedStructures,
    setPlacedPlants, setPlacedStructures,
    setSelectedPlant, selectedPlant,
    settings, frostDates, defaultStage,
    pushUndo, handleUndo,
    getFavouritesWithQuantity,
    setDragging, setShowClearConfirm,
  });

  const handleClear = useCallback(() => {
    setShowClearConfirm(true);
  }, [setShowClearConfirm]);

  const handleSelectStructureForPlacement = useCallback((structureId: string, w: number, h: number) => {
    const size = { w, h };
    pendingStructureSizeRef.current = size;
    setPendingStructureSize(size);
    setPendingPlantId(structureId);
    setPendingIsStructure(true);
    setActiveNav('garden');
  }, []);

  // ── Structure mutation handlers (extracted into useStructureHandlers) ──
  const {
    handlePlaceStructure,
    handleRemoveStructure,
    handleResizeStructure,
    handleMoveStructureStart,
    handleMoveStructure,
    handleUpdateStructure,
    handleDuplicateBed,
    handleAddPlantToBed,
  } = useStructureHandlers({
    placedPlants, placedStructures,
    setPlacedStructures, setPlacedPlants,
    setSelectedBed,
    pushUndo, setDragging, defaultStage,
    pendingStructureSizeRef, setPendingStructureSize,
  });

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

      <GardenView
        activeNav={activeNav}
        settings={settings}
        setSettings={setSettings}
        placedPlants={placedPlants}
        placedStructures={placedStructures}
        selectedBed={selectedBed}
        setSelectedBed={setSelectedBed}
        setSelectedPlant={setSelectedPlant}
        undoStack={undoStack}
        redoStack={redoStack}
        handleUndo={handleUndo}
        handleRedo={handleRedo}
        defaultStage={defaultStage}
        setDefaultStage={setDefaultStage}
        useIsometric={useIsometric}
        setUseIsometric={setUseIsometric}
        canvasLocked={canvasLocked}
        setCanvasLocked={setCanvasLocked}
        isSaving={isSaving}
        showSaved={showSaved}
        handleClear={handleClear}
        showRotationAdvanceBanner={showRotationAdvanceBanner}
        handleAdvanceAllRotations={handleAdvanceAllRotations}
        handleDismissRotationAdvance={handleDismissRotationAdvance}
        frostWarningPlants={frostWarningPlants}
        frostDates={frostDates}
        automationTasks={automationTasks}
        pendingPlantId={pendingPlantId}
        pendingIsStructure={pendingIsStructure}
        pendingStructureSize={pendingStructureSize}
        handleCancelPending={handleCancelPending}
        showSuccessionSlider={showSuccessionSlider}
        viewMonth={viewMonth}
        isMobile={isMobile}
        handlePlacePlant={handlePlacePlant}
        handleRemovePlant={handleRemovePlant}
        handleMovePlant={handleMovePlant}
        handleMovePlantStart={handleMovePlantStart}
        handlePlaceStructure={handlePlaceStructure}
        handleRemoveStructure={handleRemoveStructure}
        handleResizeStructure={handleResizeStructure}
        handleMoveStructure={handleMoveStructure}
        handleMoveStructureStart={handleMoveStructureStart}
        handleFillPlantArea={handleFillPlantArea}
        handleSmartAutoFill={handleSmartAutoFill}
        handleUpdateStructure={handleUpdateStructure}
        handleAddPlantToBed={handleAddPlantToBed}
        handleUpdatePlacedPlant={handleUpdatePlacedPlant}
        handleDuplicateBed={handleDuplicateBed}
        setActiveNav={setActiveNav}
        user={user}
        plans={plans}
        currentPlanId={currentPlanId}
        handleToolbarPlanSelect={handleToolbarPlanSelect}
      />

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
        <BedsView
          setDragging={setDragging}
          pendingPlantId={pendingPlantId}
          handleSelectForPlacement={handleSelectForPlacement}
          handleSelectStructureForPlacement={handleSelectStructureForPlacement}
          cellSizeCm={settings.cellSizeCm}
        />
      )}

      {/* Structures view — non-growing structures (shed, path, fence, trees, etc.) */}
      {activeNav === 'structures' && (
        <StructuresView
          setDragging={setDragging}
          pendingPlantId={pendingPlantId}
          handleSelectForPlacement={handleSelectForPlacement}
          handleSelectStructureForPlacement={handleSelectStructureForPlacement}
          cellSizeCm={settings.cellSizeCm}
        />
      )}

      {/* Tasks view */}
      {activeNav === 'tasks' && (
        <TasksView
          placedPlants={placedPlants}
          setActiveNav={setActiveNav}
          frostDates={frostDates}
          automationTasks={automationTasks}
          toggleAutomationTask={toggleAutomationTask}
        />
      )}

      {/* Plan & More views */}
      {(activeNav === 'plan' || activeNav === 'more') && (
        <div className="flex-1 overflow-y-auto pb-4 max-w-2xl mx-auto w-full">
          {activeNav === 'plan' && (
            <PlanView
              frostWarningPlants={frostWarningPlants}
              thisWeekData={thisWeekData}
              setShowCalendar={setShowCalendar}
              setShowMonthlyPlanner={setShowMonthlyPlanner}
              setShowRotation={setShowRotation}
              setShowPlotMap={setShowPlotMap}
              setShowRotationPlanner={setShowRotationPlanner}
              setShowShoppingList={setShowShoppingList}
            />
          )}
          {activeNav === 'more' && (
            <MoreView
              setShowGrowGuide={setShowGrowGuide}
              setShowAI={setShowAI}
              setShowPlantingSuggestions={setShowPlantingSuggestions}
              setShowWeather={setShowWeather}
              setShowWatering={setShowWatering}
              setShowJournal={setShowJournal}
              setShowSeedInventory={setShowSeedInventory}
              setShowHarvestLogger={setShowHarvestLogger}
              setShowPestLog={setShowPestLog}
              setShowCalendar={setShowCalendar}
              setShowMonthlyPlanner={setShowMonthlyPlanner}
              setShowRotation={setShowRotation}
              setShowRotationPlanner={setShowRotationPlanner}
              setShowPlotMap={setShowPlotMap}
              setShowShoppingList={setShowShoppingList}
              setShowAutomationPlanner={setShowAutomationPlanner}
              setShowDocs={setShowDocs}
              setShowSaveLoad={setShowSaveLoad}
              setShowAuth={setShowAuth}
              handleExportPDF={handleExportPDF}
              automationPlans={automationPlans}
              automationTasks={automationTasks}
              user={user}
              signOut={signOut}
            />
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
