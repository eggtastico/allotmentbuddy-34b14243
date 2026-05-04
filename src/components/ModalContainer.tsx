import React, { Suspense } from 'react';
import { PlacedPlant, PlacedStructure, PlotSettings, PlantStage } from '@/types/garden';
import { LocationData } from '@/hooks/useGardenState';
import { GardenPlanRow } from '@/lib/schemas';
import { GardenExportData } from '@/utils/gardenExportImport';
import { GardenTemplate } from '@/data/gardenTemplates';

// Lazy-loaded modal components
const PlantingCalendar = React.lazy(() =>
  import('@/components/PlantingCalendar').then((m) => ({ default: m.PlantingCalendar }))
);
const AIChat = React.lazy(() =>
  import('@/components/AIChat').then((m) => ({ default: m.AIChat }))
);
const AuthModal = React.lazy(() =>
  import('@/components/AuthModal').then((m) => ({ default: m.AuthModal }))
);
const SaveLoadPanel = React.lazy(() =>
  import('@/components/SaveLoadPanel').then((m) => ({ default: m.SaveLoadPanel }))
);
const RotationPanel = React.lazy(() =>
  import('@/components/RotationPanel').then((m) => ({ default: m.RotationPanel }))
);
const WeatherYieldPanel = React.lazy(() =>
  import('@/components/WeatherYieldPanel').then((m) => ({ default: m.WeatherYieldPanel }))
);
const WateringGuide = React.lazy(() =>
  import('@/components/WateringGuide').then((m) => ({ default: m.WateringGuide }))
);
const PlotMapPanel = React.lazy(() =>
  import('@/components/PlotMapPanel').then((m) => ({ default: m.PlotMapPanel }))
);
const GardenJournal = React.lazy(() =>
  import('@/components/GardenJournal').then((m) => ({ default: m.GardenJournal }))
);
const DocsGuide = React.lazy(() =>
  import('@/components/DocsGuide').then((m) => ({ default: m.DocsGuide }))
);
const SeedInventory = React.lazy(() =>
  import('@/components/SeedInventory').then((m) => ({ default: m.SeedInventory }))
);
const PlantingSuggestions = React.lazy(() =>
  import('@/components/PlantingSuggestions').then((m) => ({ default: m.PlantingSuggestions }))
);
const GardenTasks = React.lazy(() =>
  import('@/components/GardenTasks').then((m) => ({ default: m.GardenTasks }))
);
const MonthlyPlanner = React.lazy(() =>
  import('@/components/MonthlyPlanner').then((m) => ({ default: m.MonthlyPlanner }))
);
const GrowGuide = React.lazy(() =>
  import('@/components/GrowGuide').then((m) => ({ default: m.GrowGuide }))
);
const ShoppingList = React.lazy(() =>
  import('@/components/ShoppingList').then((m) => ({ default: m.ShoppingList }))
);
const TemplatePickerModal = React.lazy(() =>
  import('@/components/TemplatePickerModal').then((m) => ({ default: m.TemplatePickerModal }))
);

export interface ModalContainerProps {
  // Modal visibility states
  showCalendar: boolean;
  setShowCalendar: (v: boolean) => void;
  showAI: boolean;
  setShowAI: (v: boolean) => void;
  showAuth: boolean;
  setShowAuth: (v: boolean) => void;
  showSaveLoad: boolean;
  setShowSaveLoad: (v: boolean) => void;
  showRotation: boolean;
  setShowRotation: (v: boolean) => void;
  showWeather: boolean;
  setShowWeather: (v: boolean) => void;
  showWatering: boolean;
  setShowWatering: (v: boolean) => void;
  showPlotMap: boolean;
  setShowPlotMap: (v: boolean) => void;
  showJournal: boolean;
  setShowJournal: (v: boolean) => void;
  showDocs: boolean;
  setShowDocs: (v: boolean) => void;
  showSeedInventory: boolean;
  setShowSeedInventory: (v: boolean) => void;
  showPlantingSuggestions: boolean;
  setShowPlantingSuggestions: (v: boolean) => void;
  showTasks: boolean;
  setShowTasks: (v: boolean) => void;
  showMonthlyPlanner: boolean;
  setShowMonthlyPlanner: (v: boolean) => void;
  showGrowGuide: boolean;
  setShowGrowGuide: (v: boolean) => void;
  showShoppingList: boolean;
  setShowShoppingList: (v: boolean) => void;
  showTemplatePicker: boolean;
  setShowTemplatePicker: (v: boolean) => void;

  // Data
  placedPlants: PlacedPlant[];
  placedStructures: PlacedStructure[];
  settings: PlotSettings;
  location: LocationData | null;
  currentPlanId: string | null;
  planName: string;
  plans: GardenPlanRow[];
  user: { id: string } | null;

  // Callbacks
  onLoadPlan: (plan: GardenPlanRow) => void;
  onNewPlan: () => void;
  onOptimizeRotation: () => void;
  onExportPDF: () => void;
  onImport: (data: GardenExportData) => void;
  onLoadTemplate: (template: GardenTemplate) => void;
}

export function ModalContainer(props: ModalContainerProps) {
  const {
    showCalendar,
    setShowCalendar,
    showAI,
    setShowAI,
    showAuth,
    setShowAuth,
    showSaveLoad,
    setShowSaveLoad,
    showRotation,
    setShowRotation,
    showWeather,
    setShowWeather,
    showWatering,
    setShowWatering,
    showPlotMap,
    setShowPlotMap,
    showJournal,
    setShowJournal,
    showDocs,
    setShowDocs,
    showSeedInventory,
    setShowSeedInventory,
    showPlantingSuggestions,
    setShowPlantingSuggestions,
    showTasks,
    setShowTasks,
    showMonthlyPlanner,
    setShowMonthlyPlanner,
    showGrowGuide,
    setShowGrowGuide,
    showShoppingList,
    setShowShoppingList,
    showTemplatePicker,
    setShowTemplatePicker,
    placedPlants,
    placedStructures,
    settings,
    location,
    currentPlanId,
    planName,
    plans,
    user,
    onLoadPlan,
    onNewPlan,
    onOptimizeRotation,
    onExportPDF,
    onImport,
    onLoadTemplate,
  } = props;

  return (
    <>
      {showCalendar && (
        <Suspense fallback={null}>
          <PlantingCalendar
            placedPlants={placedPlants}
            location={location}
            onClose={() => setShowCalendar(false)}
          />
        </Suspense>
      )}

      {showAI && (
        <Suspense fallback={null}>
          <AIChat
            settings={settings}
            plants={placedPlants}
            location={location}
            onClose={() => setShowAI(false)}
          />
        </Suspense>
      )}

      {showAuth && (
        <Suspense fallback={null}>
          <AuthModal onClose={() => setShowAuth(false)} />
        </Suspense>
      )}

      {showSaveLoad && user && (
        <Suspense fallback={null}>
          <SaveLoadPanel
            currentPlanId={currentPlanId}
            currentName={planName}
            settings={settings}
            plants={placedPlants}
            beds={placedStructures}
            onLoad={onLoadPlan}
            onNewPlan={onNewPlan}
            onClose={() => setShowSaveLoad(false)}
            onImport={onImport}
          />
        </Suspense>
      )}

      {showWeather && (
        <Suspense fallback={null}>
          <WeatherYieldPanel
            plants={placedPlants}
            location={location}
            onClose={() => setShowWeather(false)}
          />
        </Suspense>
      )}

      {showRotation && (
        <Suspense fallback={null}>
          <RotationPanel
            plants={placedPlants}
            onOptimize={onOptimizeRotation}
            onClose={() => setShowRotation(false)}
          />
        </Suspense>
      )}

      {showWatering && (
        <Suspense fallback={null}>
          <WateringGuide
            plants={placedPlants}
            structures={placedStructures}
            location={location}
            onClose={() => setShowWatering(false)}
          />
        </Suspense>
      )}

      {showPlotMap && (
        <Suspense fallback={null}>
          <PlotMapPanel onClose={() => setShowPlotMap(false)} />
        </Suspense>
      )}

      {showJournal && (
        <Suspense fallback={null}>
          <GardenJournal onClose={() => setShowJournal(false)} />
        </Suspense>
      )}

      {showDocs && (
        <Suspense fallback={null}>
          <DocsGuide onClose={() => setShowDocs(false)} />
        </Suspense>
      )}

      {showSeedInventory && (
        <Suspense fallback={null}>
          <SeedInventory onClose={() => setShowSeedInventory(false)} />
        </Suspense>
      )}

      {showPlantingSuggestions && (
        <Suspense fallback={null}>
          <PlantingSuggestions onClose={() => setShowPlantingSuggestions(false)} />
        </Suspense>
      )}

      {showTasks && (
        <Suspense fallback={null}>
          <GardenTasks onClose={() => setShowTasks(false)} placedPlants={placedPlants} />
        </Suspense>
      )}

      {showMonthlyPlanner && (
        <Suspense fallback={null}>
          <MonthlyPlanner onClose={() => setShowMonthlyPlanner(false)} />
        </Suspense>
      )}

      {showGrowGuide && (
        <Suspense fallback={null}>
          <GrowGuide onClose={() => setShowGrowGuide(false)} />
        </Suspense>
      )}

      {showShoppingList && (
        <Suspense fallback={null}>
          <ShoppingList
            placedPlants={placedPlants}
            onClose={() => setShowShoppingList(false)}
          />
        </Suspense>
      )}

      {showTemplatePicker && (
        <Suspense fallback={null}>
          <TemplatePickerModal
            onSelect={onLoadTemplate}
            onClose={() => setShowTemplatePicker(false)}
          />
        </Suspense>
      )}
    </>
  );
}
