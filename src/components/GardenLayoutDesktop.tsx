import React, { useState, useRef, useCallback } from 'react';
import { PlacedPlant, PlotSettings, PlacedStructure, PlantStage } from '@/types/garden';
import { PlantSidebar } from '@/components/PlantSidebar';
import { IsometricGardenGrid } from '@/components/IsometricGardenGrid';
import { PlantInfoPanel } from '@/components/PlantInfoPanel';
import { calculateShadeZones, getSunExposure } from '@/utils/sunCalculator';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface GardenLayoutDesktopProps {
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
  user: { id: string } | null;

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
  onDragStart: (id: string | null) => void;
  onStructureModeChange: (mode: boolean) => void;
  onUpdatePlant: (plant: PlacedPlant) => void;
  /** Ref assigned an async function that returns the canvas as a PNG data URL — used by PDF export. Pass scale>1 for high-res. */
  canvasExportRef?: React.MutableRefObject<((scale?: number) => Promise<string | null>) | null>;
}

export function GardenLayoutDesktop(props: GardenLayoutDesktopProps) {
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
    user,
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
    onDragStart,
    onStructureModeChange,
    onUpdatePlant,
    canvasExportRef,
  } = props;

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Use a ref callback + state so the portal target is available by the time GardenGrid renders.
  const controlsPortalRef = useRef<HTMLDivElement | null>(null);
  const [, forceUpdate] = useState(0);
  const controlsPortalCallbackRef = useCallback((el: HTMLDivElement | null) => {
    controlsPortalRef.current = el;
    if (el) forceUpdate(n => n + 1);
  }, []);

  return (
    <div className="flex-1 flex overflow-hidden relative">
      {/* Backdrop for mobile sidebar */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 sm:hidden"
          onClick={() => onMobileSidebarOpenChange(false)}
        />
      )}

      {/* Mobile sidebar overlay — fixed, only visible when mobileSidebarOpen */}
      {mobileSidebarOpen && (
        <div className="fixed inset-y-0 left-0 z-30 shadow-xl w-full sm:hidden flex flex-col">
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

      {/* Desktop sidebar — collapsible, always mounted to preserve filter/search state */}
      <div
        className="hidden sm:flex flex-shrink-0 relative overflow-hidden transition-[width] duration-200"
        style={{ width: sidebarCollapsed ? 40 : 256 }}
      >
        {/* Full sidebar content — fades out when collapsed, non-interactive */}
        <div
          className="h-full flex flex-col transition-opacity duration-150"
          style={{
            width: 256,
            opacity: sidebarCollapsed ? 0 : 1,
            pointerEvents: sidebarCollapsed ? 'none' : 'auto',
          }}
        >
          {/* Plant library — grows to fill available space */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <PlantSidebar
              onDragStart={onDragStart}
              pendingPlantId={pendingPlantId}
              onSelectPlant={onSelectForPlacement}
              onStructureModeChange={onStructureModeChange}
            />
          </div>
          {/* Portal target for minimap + canvas layer controls */}
          <div
            ref={controlsPortalCallbackRef}
            className="border-t border-border/60 bg-card p-2 space-y-2 shrink-0"
          />
        </div>

        {/* Collapsed strip — shown over the faded sidebar when collapsed */}
        {sidebarCollapsed && (
          <div className="absolute inset-0 bg-card border-r border-border flex flex-col items-center gap-2 py-10">
            <span
              className="text-[9px] font-semibold text-muted-foreground tracking-wide select-none"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              🌱 Plant Library
            </span>
          </div>
        )}

        {/* Toggle button — always visible, positioned at right edge of container */}
        <button
          onClick={() => setSidebarCollapsed(v => !v)}
          className="absolute top-3 right-1.5 z-30 h-6 w-6 rounded-full border border-border bg-card shadow-sm flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title={sidebarCollapsed ? 'Expand plant library' : 'Collapse plant library'}
        >
          {sidebarCollapsed
            ? <ChevronRight className="h-3 w-3" />
            : <ChevronLeft className="h-3 w-3" />
          }
        </button>
      </div>

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
        isMobile={false}
        controlsPortalRef={controlsPortalRef}
        canvasExportRef={canvasExportRef}
      />

      {/* Plant Info Panel — absolute overlay so it doesn't push the grid */}
      {selectedPlant && (() => {
        const cellsPerUnit = settings.unit === 'meters' ? (100 / settings.cellSizeCm) : (30.48 / settings.cellSizeCm);
        const c = Math.round(settings.widthM * cellsPerUnit);
        const r = Math.round(settings.heightM * cellsPerUnit);
        const zones = calculateShadeZones(placedStructures, settings, c, r);
        const sunExp = getSunExposure(selectedPlant.x, selectedPlant.y, zones);
        const successionTask = async (title: string, description: string) => {
          if (!user) { toast.error('Sign in to add tasks'); return; }
          const { error } = await supabase.from('garden_tasks').insert({ user_id: user.id, title, description, period: 'monthly' });
          if (error) { toast.error('Failed to add task'); } else { toast.success('Succession task added! 📋'); }
        };
        return (
          <>
            {/* Desktop: absolute overlay on right side */}
            <div className="hidden sm:block absolute top-2 right-2 z-30 shadow-2xl" style={{ width: 288 }}>
              <PlantInfoPanel
                placed={selectedPlant}
                allPlaced={placedPlants}
                onClose={() => onSelectPlant(null)}
                onRemove={onRemovePlant}
                onUpdatePlaced={onUpdatePlant}
                sunExposure={sunExp}
                onAddSuccessionTask={successionTask}
              />
            </div>
            {/* Mobile: modal */}
            <PlantInfoPanel
              placed={selectedPlant}
              allPlaced={placedPlants}
              onClose={() => onSelectPlant(null)}
              onRemove={onRemovePlant}
              onUpdatePlaced={onUpdatePlant}
              modal={true}
              sunExposure={sunExp}
              onAddSuccessionTask={successionTask}
            />
          </>
        );
      })()}
    </div>
  );
}
