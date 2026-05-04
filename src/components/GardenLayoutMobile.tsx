import React from 'react';
import { PlacedPlant, PlotSettings, PlacedStructure, PlantStage } from '@/types/garden';
import { PhotosView } from '@/components/PhotosView';
import { TasksView } from '@/components/TasksView';
import { BottomNavBar } from '@/components/BottomNavBar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { PlantSidebar } from '@/components/PlantSidebar';
import { IsometricGardenGrid } from '@/components/IsometricGardenGrid';
import { PlantInfoPanel } from '@/components/PlantInfoPanel';
import { calculateShadeZones, getSunExposure } from '@/utils/sunCalculator';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { NavSection } from '@/components/AppShell';

export interface GardenLayoutMobileProps {
  settings: PlotSettings;
  placedPlants: PlacedPlant[];
  placedStructures: PlacedStructure[];
  selectedPlant: PlacedPlant | null;
  pendingPlantId: string | null;
  pendingIsStructure: boolean;
  dragging: string | null;
  showSunOverlay: boolean;
  structureMode: boolean;
  mobileSidebarOpen: boolean;
  activeNav: NavSection;
  user: { id: string } | null;

  // Modal setters
  onShowCalendar: () => void;
  onShowAI: () => void;
  onShowJournal: () => void;
  onShowPlotMap: () => void;
  onShowWeather: () => void;
  onShowRotation: () => void;
  onShowDocs: () => void;
  onShowShoppingList: () => void;

  // Callbacks
  onSelectPlant: (plant: PlacedPlant | null) => void;
  onPlacePlant: (plantId: string, x: number, y: number) => void;
  onRemovePlant: (id: string) => void;
  onMovePlant: (id: string, x: number, y: number) => void;
  onMovePlantStart: () => void;
  onFillPlantArea: (plantId: string, originX: number, originY: number, w: number, h: number) => void;
  onSmartAutoFill: (originX: number, originY: number, w: number, h: number, isContainer: boolean) => void;
  onSelectForPlacement: (plantId: string, isStructure: boolean) => void;
  onCancelPending: () => void;
  onPlaceStructure: (structureId: string, x: number, y: number) => void;
  onRemoveStructure: (id: string) => void;
  onResizeStructure: (id: string, widthCells: number, heightCells: number) => void;
  onMoveStructure: (id: string, x: number, y: number) => void;
  onSettingsChange: (settings: PlotSettings) => void;
  onShowSunOverlayChange: (show: boolean) => void;
  onMobileSidebarOpenChange: (open: boolean) => void;
  onActiveNavChange: (nav: NavSection) => void;
  onDragStart: (id: string | null) => void;
  onStructureModeChange: (mode: boolean) => void;
  onUpdatePlant: (plant: PlacedPlant) => void;
}

export function GardenLayoutMobile(props: GardenLayoutMobileProps) {
  const {
    settings,
    placedPlants,
    placedStructures,
    selectedPlant,
    pendingPlantId,
    pendingIsStructure,
    dragging,
    showSunOverlay,
    structureMode,
    mobileSidebarOpen,
    activeNav,
    user,
    onShowCalendar,
    onShowAI,
    onShowJournal,
    onShowPlotMap,
    onShowWeather,
    onShowRotation,
    onShowDocs,
    onShowShoppingList,
    onSelectPlant,
    onPlacePlant,
    onRemovePlant,
    onMovePlant,
    onMovePlantStart,
    onFillPlantArea,
    onSmartAutoFill,
    onSelectForPlacement,
    onCancelPending,
    onPlaceStructure,
    onRemoveStructure,
    onResizeStructure,
    onMoveStructure,
    onSettingsChange,
    onShowSunOverlayChange,
    onMobileSidebarOpenChange,
    onActiveNavChange,
    onDragStart,
    onStructureModeChange,
    onUpdatePlant,
  } = props;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Main garden view */}
      <div className={`${activeNav !== 'garden' ? 'hidden' : 'flex-1 flex'} overflow-hidden relative`}>
        {/* Backdrop for mobile sidebar */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-20 sm:hidden"
            onClick={() => onMobileSidebarOpenChange(false)}
          />
        )}

        {/* Sidebar - drawer on mobile, sidebar on desktop */}
        {mobileSidebarOpen && (
          <div className="fixed inset-y-0 left-0 z-30 shadow-xl w-full sm:w-64 bg-card overflow-y-auto">
            <PlantSidebar
              onDragStart={onDragStart}
              pendingPlantId={pendingPlantId}
              onSelectPlant={onSelectForPlacement}
              onStructureModeChange={onStructureModeChange}
            />
            <button
              className="absolute top-2 right-2 z-40 h-8 w-8 rounded-full bg-muted flex items-center justify-center"
              onClick={() => onMobileSidebarOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Garden Grid */}
        <IsometricGardenGrid
          settings={settings}
          plants={placedPlants}
          structures={placedStructures}
          onPlacePlant={onPlacePlant}
          onRemovePlant={onRemovePlant}
          onMovePlant={onMovePlant}
          onMovePlantStart={onMovePlantStart}
          onSelectPlant={onSelectPlant}
          onPlaceStructure={onPlaceStructure}
          onRemoveStructure={onRemoveStructure}
          onResizeStructure={onResizeStructure}
          onMoveStructure={onMoveStructure}
          selectedPlantId={selectedPlant?.id ?? null}
          onFillPlantArea={onFillPlantArea}
          onSmartAutoFill={onSmartAutoFill}
          onSettingsChange={onSettingsChange}
          pendingPlantId={pendingPlantId}
          pendingIsStructure={pendingIsStructure}
          onCancelPending={onCancelPending}
          showSunOverlay={showSunOverlay}
          onShowSunOverlayChange={onShowSunOverlayChange}
          structureMode={structureMode}
          isMobile={true}
        />

        {/* Plant Info Panel - only modal version on mobile */}
        {selectedPlant && (
          <>
            {/* Tablet/Mobile modal version */}
            <PlantInfoPanel
              placed={selectedPlant}
              allPlaced={placedPlants}
              onClose={() => onSelectPlant(null)}
              onRemove={onRemovePlant}
              onUpdatePlaced={onUpdatePlant}
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
          </>
        )}
      </div>

      {/* Alternative views for mobile navigation */}
      {activeNav !== 'garden' && (
        <div className="flex-1 overflow-y-auto pb-24">
          {activeNav === 'photos' && <PhotosView plants={placedPlants} />}
          {activeNav === 'tasks' && <TasksView plants={placedPlants} />}
          {activeNav === 'more' && (
            <div className="p-4 space-y-6">
              <h2 className="text-2xl font-semibold text-foreground">⚙️ More Options</h2>

              {/* Plan Section */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Plan</h3>
                <div className="space-y-2">
                  <button onClick={onShowCalendar} className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm">📅 Planting Calendar</button>
                  <button onClick={onShowPlotMap} className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm">🗺️ Plot Map</button>
                  <button onClick={onShowRotation} className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm">🔄 Crop Rotation</button>
                </div>
              </div>

              {/* Grow Section */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Grow</h3>
                <div className="space-y-2">
                  <button onClick={onShowAI} className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm">🤖 AI Assistant</button>
                  <button onClick={onShowWeather} className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm">☀️ Weather & Yield</button>
                  <button onClick={onShowDocs} className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm">📚 Growing Guide</button>
                </div>
              </div>

              {/* Track Section */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Track</h3>
                <div className="space-y-2">
                  <button onClick={onShowJournal} className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm">📔 Garden Journal</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mobile bottom nav bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-10">
        <BottomNavBar active={activeNav} onNavigate={onActiveNavChange} />
      </div>
    </div>
  );
}
