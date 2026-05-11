import React, { Suspense } from 'react';
import { PlacedPlant, PlacedStructure, PlotSettings } from '@/types/garden';
import { PanelSkeleton } from '@/components/PanelSkeleton';
import { FrostDates } from '@/utils/frostDateCalculator';
import { GardenPlanRow } from '@/lib/schemas';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Lazy-loaded modal components
const PlantingCalendar = React.lazy(() => import('@/components/PlantingCalendar').then(m => ({ default: m.PlantingCalendar })));
const AIChat = React.lazy(() => import('@/components/AIChat').then(m => ({ default: m.AIChat })));
const AuthModal = React.lazy(() => import('@/components/AuthModal').then(m => ({ default: m.AuthModal })));
const SaveLoadPanel = React.lazy(() => import('@/components/SaveLoadPanel').then(m => ({ default: m.SaveLoadPanel })));
const RotationPanel = React.lazy(() => import('@/components/RotationPanel').then(m => ({ default: m.RotationPanel })));
const WeatherYieldPanel = React.lazy(() => import('@/components/WeatherYieldPanel').then(m => ({ default: m.WeatherYieldPanel })));
const WateringGuide = React.lazy(() => import('@/components/WateringGuide').then(m => ({ default: m.WateringGuide })));
const PlotMapPanel = React.lazy(() => import('@/components/PlotMapPanel').then(m => ({ default: m.PlotMapPanel })));
const GardenJournal = React.lazy(() => import('@/components/GardenJournal').then(m => ({ default: m.GardenJournal })));
const DocsGuide = React.lazy(() => import('@/components/DocsGuide').then(m => ({ default: m.DocsGuide })));
const SeedInventory = React.lazy(() => import('@/components/SeedInventory').then(m => ({ default: m.SeedInventory })));
const PlantingSuggestions = React.lazy(() => import('@/components/PlantingSuggestions').then(m => ({ default: m.PlantingSuggestions })));
const GardenTasks = React.lazy(() => import('@/components/GardenTasks').then(m => ({ default: m.GardenTasks })));
const MonthlyPlanner = React.lazy(() => import('@/components/MonthlyPlanner').then(m => ({ default: m.MonthlyPlanner })));
const GrowGuide = React.lazy(() => import('@/components/GrowGuide').then(m => ({ default: m.GrowGuide })));
const ShoppingList = React.lazy(() => import('@/components/ShoppingList').then(m => ({ default: m.ShoppingList })));
const HarvestLogger = React.lazy(() => import('@/components/HarvestLogger').then(m => ({ default: m.HarvestLogger })));
const PestDiseaseLog = React.lazy(() => import('@/components/PestDiseaseLog').then(m => ({ default: m.PestDiseaseLog })));
const CropRotationPlanner = React.lazy(() => import('@/components/CropRotationPlanner').then(m => ({ default: m.CropRotationPlanner })));

interface LocationData {
  name: string;
  lat: number;
  lon: number;
  region?: string;
}

export interface ModalContainerProps {
  // Modal visibility (from useGardenModals)
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
  showHarvestLogger: boolean;
  setShowHarvestLogger: (v: boolean) => void;
  showPestLog: boolean;
  setShowPestLog: (v: boolean) => void;
  showRotationPlanner: boolean;
  setShowRotationPlanner: (v: boolean) => void;
  showClearConfirm: boolean;
  setShowClearConfirm: (v: boolean) => void;

  // Data
  placedPlants: PlacedPlant[];
  placedStructures: PlacedStructure[];
  settings: PlotSettings;
  location: LocationData | null;
  currentPlanId: string | null;
  planName: string;
  frostDates: FrostDates | null;
  user: { id: string } | null;

  // Callbacks
  onLoadPlan: (plan: GardenPlanRow) => void;
  onNewPlan: () => void;
  onOptimizeRotation: () => void;
  onClearConfirm: () => void;
}

export function ModalContainer(props: ModalContainerProps) {
  return (
    <>
      {props.showCalendar && (
        <Suspense fallback={<PanelSkeleton />}>
          <PlantingCalendar placedPlants={props.placedPlants} location={props.location} onClose={() => props.setShowCalendar(false)} />
        </Suspense>
      )}
      {props.showAI && (
        <Suspense fallback={<PanelSkeleton />}>
          <AIChat settings={props.settings} plants={props.placedPlants} location={props.location} onClose={() => props.setShowAI(false)} />
        </Suspense>
      )}
      {props.showAuth && (
        <Suspense fallback={<PanelSkeleton />}>
          <AuthModal onClose={() => props.setShowAuth(false)} />
        </Suspense>
      )}
      {props.showSaveLoad && props.user && (
        <Suspense fallback={<PanelSkeleton />}>
          <SaveLoadPanel
            currentPlanId={props.currentPlanId}
            currentName={props.planName}
            settings={props.settings}
            plants={props.placedPlants}
            beds={props.placedStructures}
            onLoad={props.onLoadPlan}
            onNewPlan={props.onNewPlan}
            onClose={() => props.setShowSaveLoad(false)}
          />
        </Suspense>
      )}
      {props.showWeather && (
        <Suspense fallback={<PanelSkeleton />}>
          <WeatherYieldPanel plants={props.placedPlants} location={props.location} onClose={() => props.setShowWeather(false)} />
        </Suspense>
      )}
      {props.showRotation && (
        <Suspense fallback={<PanelSkeleton />}>
          <RotationPanel plants={props.placedPlants} onOptimize={props.onOptimizeRotation} onClose={() => props.setShowRotation(false)} />
        </Suspense>
      )}
      {props.showWatering && (
        <Suspense fallback={<PanelSkeleton />}>
          <WateringGuide plants={props.placedPlants} structures={props.placedStructures} location={props.location} onClose={() => props.setShowWatering(false)} />
        </Suspense>
      )}
      {props.showPlotMap && (
        <Suspense fallback={<PanelSkeleton />}>
          <PlotMapPanel onClose={() => props.setShowPlotMap(false)} />
        </Suspense>
      )}
      {props.showJournal && (
        <Suspense fallback={<PanelSkeleton />}>
          <GardenJournal onClose={() => props.setShowJournal(false)} />
        </Suspense>
      )}
      {props.showDocs && (
        <Suspense fallback={<PanelSkeleton />}>
          <DocsGuide onClose={() => props.setShowDocs(false)} />
        </Suspense>
      )}
      {props.showSeedInventory && (
        <Suspense fallback={<PanelSkeleton />}>
          <SeedInventory onClose={() => props.setShowSeedInventory(false)} />
        </Suspense>
      )}
      {props.showPlantingSuggestions && (
        <Suspense fallback={<PanelSkeleton />}>
          <PlantingSuggestions onClose={() => props.setShowPlantingSuggestions(false)} />
        </Suspense>
      )}
      {props.showTasks && (
        <Suspense fallback={<PanelSkeleton />}>
          <GardenTasks placedPlants={props.placedPlants} frostDates={props.frostDates} onClose={() => props.setShowTasks(false)} />
        </Suspense>
      )}
      {props.showMonthlyPlanner && (
        <Suspense fallback={<PanelSkeleton />}>
          <MonthlyPlanner onClose={() => props.setShowMonthlyPlanner(false)} />
        </Suspense>
      )}
      {props.showGrowGuide && (
        <Suspense fallback={<PanelSkeleton />}>
          <GrowGuide onClose={() => props.setShowGrowGuide(false)} />
        </Suspense>
      )}
      {props.showShoppingList && (
        <Suspense fallback={<PanelSkeleton />}>
          <ShoppingList placedPlants={props.placedPlants} onClose={() => props.setShowShoppingList(false)} />
        </Suspense>
      )}
      {props.showHarvestLogger && (
        <Suspense fallback={<PanelSkeleton />}>
          <HarvestLogger placedPlants={props.placedPlants} gardenId={props.currentPlanId ?? 'local'} onClose={() => props.setShowHarvestLogger(false)} />
        </Suspense>
      )}
      {props.showPestLog && (
        <Suspense fallback={<PanelSkeleton />}>
          <PestDiseaseLog placedPlants={props.placedPlants} gardenId={props.currentPlanId ?? 'local'} onClose={() => props.setShowPestLog(false)} />
        </Suspense>
      )}
      {props.showRotationPlanner && (
        <Suspense fallback={<PanelSkeleton />}>
          <CropRotationPlanner placedPlants={props.placedPlants} onClose={() => props.setShowRotationPlanner(false)} />
        </Suspense>
      )}
      <AlertDialog open={props.showClearConfirm} onOpenChange={props.setShowClearConfirm}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear this garden plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all placed plants and structures from your current layout.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={props.onClearConfirm}>
              Delete plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
