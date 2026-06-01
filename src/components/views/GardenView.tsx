import React, { Suspense } from 'react';
import { PlacedPlant, PlacedStructure, PlotSettings, PlantStage } from '@/types/garden';
import { GardenPlanRow } from '@/lib/schemas';
import { type NavSection } from '@/components/AppShell';
import { FrostDates } from '@/utils/frostDateCalculator';
import { AutomationTask } from '@/utils/automationPlannerUtils';
import { GardenGrid } from '@/components/GardenGrid';
import { GardenHealthDashboard } from '@/components/GardenHealthDashboard';
import { BedPlantingPanel } from '@/components/BedPlantingPanel';
import MobileToolbar from '@/components/MobileToolbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Undo2, Redo2, History, Loader2, Check, Compass, Grid3X3, Minus, Plus, RotateCcw, Lock, Unlock } from 'lucide-react';
import { User } from '@supabase/supabase-js';

const IsometricGardenGrid = React.lazy(() => import('@/components/IsometricGardenGrid').then(m => ({ default: m.IsometricGardenGrid })));

interface GardenViewProps {
  activeNav: NavSection;
  settings: PlotSettings;
  setSettings: React.Dispatch<React.SetStateAction<PlotSettings>>;
  placedPlants: PlacedPlant[];
  placedStructures: PlacedStructure[];
  selectedBed: PlacedStructure | null;
  setSelectedBed: React.Dispatch<React.SetStateAction<PlacedStructure | null>>;
  setSelectedPlant: React.Dispatch<React.SetStateAction<PlacedPlant | null>>;
  undoStack: unknown[];
  redoStack: unknown[];
  handleUndo: () => void;
  handleRedo: () => void;
  defaultStage: PlantStage;
  setDefaultStage: React.Dispatch<React.SetStateAction<PlantStage>>;
  useIsometric: boolean;
  setUseIsometric: React.Dispatch<React.SetStateAction<boolean>>;
  canvasLocked: boolean;
  setCanvasLocked: React.Dispatch<React.SetStateAction<boolean>>;
  isSaving: boolean;
  showSaved: boolean;
  handleClear: () => void;
  showRotationAdvanceBanner: boolean;
  handleAdvanceAllRotations: () => void;
  handleDismissRotationAdvance: () => void;
  frostWarningPlants: PlacedPlant[];
  frostDates: FrostDates | null;
  automationTasks: AutomationTask[];
  pendingPlantId: string | null;
  pendingIsStructure: boolean;
  pendingStructureSize: { w: number; h: number } | null;
  handleCancelPending: () => void;
  showSuccessionSlider: boolean;
  viewMonth: number;
  isMobile: boolean;
  handlePlacePlant: (plantId: string, x: number, y: number) => void;
  handleRemovePlant: (id: string) => void;
  handleMovePlant: (id: string, x: number, y: number) => void;
  handleMovePlantStart: () => void;
  handlePlaceStructure: (structureId: string, x: number, y: number) => void;
  handleRemoveStructure: (id: string) => void;
  handleResizeStructure: (id: string, widthCells: number, heightCells: number) => void;
  handleMoveStructure: (id: string, x: number, y: number) => void;
  handleMoveStructureStart: () => void;
  handleFillPlantArea: (plantId: string, originX: number, originY: number, w: number, h: number) => void;
  handleSmartAutoFill: (originX: number, originY: number, w: number, h: number, isContainer: boolean) => void;
  handleUpdateStructure: (updated: PlacedStructure) => void;
  handleAddPlantToBed: (bed: PlacedStructure, plantId: string, col: number, row: number) => void;
  handleUpdatePlacedPlant: (updated: PlacedPlant) => void;
  handleDuplicateBed: (bedId: string) => void;
  setActiveNav: (section: NavSection) => void;
  user: User | null;
  plans: GardenPlanRow[];
  currentPlanId: string | null;
  handleToolbarPlanSelect: (plan: GardenPlanRow) => void;
}

export function GardenView({
  activeNav,
  settings,
  setSettings,
  placedPlants,
  placedStructures,
  selectedBed,
  setSelectedBed,
  setSelectedPlant,
  undoStack,
  redoStack,
  handleUndo,
  handleRedo,
  defaultStage,
  setDefaultStage,
  useIsometric,
  setUseIsometric,
  canvasLocked,
  setCanvasLocked,
  isSaving,
  showSaved,
  handleClear,
  showRotationAdvanceBanner,
  handleAdvanceAllRotations,
  handleDismissRotationAdvance,
  frostWarningPlants,
  frostDates,
  automationTasks,
  pendingPlantId,
  pendingIsStructure,
  pendingStructureSize,
  handleCancelPending,
  showSuccessionSlider,
  viewMonth,
  isMobile,
  handlePlacePlant,
  handleRemovePlant,
  handleMovePlant,
  handleMovePlantStart,
  handlePlaceStructure,
  handleRemoveStructure,
  handleResizeStructure,
  handleMoveStructure,
  handleMoveStructureStart,
  handleFillPlantArea,
  handleSmartAutoFill,
  handleUpdateStructure,
  handleAddPlantToBed,
  handleUpdatePlacedPlant,
  handleDuplicateBed,
  setActiveNav,
  user,
  plans,
  currentPlanId,
  handleToolbarPlanSelect,
}: GardenViewProps) {
  return (
    <>
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
            <Button data-testid="iso-toggle" variant={useIsometric ? 'default' : 'outline'} size="sm" className="h-7 text-xs px-2" onClick={() => setUseIsometric(v => !v)} title={useIsometric ? 'Switch to flat' : 'Switch to isometric'}>
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
            <span data-testid="plant-count" className="text-xs text-muted-foreground whitespace-nowrap">🌱 {placedPlants.length}</span>

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
    </>
  );
}
