import React, { useState } from 'react';
import {
  Undo2,
  Redo2,
  Minus,
  Plus,
  Settings2,
  Lock,
  Unlock,
  Grid3X3,
  Compass,
  RotateCcw,
  Loader2,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface MobileToolbarProps {
  // Undo/Redo
  undoCount: number;
  redoCount: number;
  onUndo: () => void;
  onRedo: () => void;
  // Zoom
  cellSizePx: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  // Stage
  defaultStage: 'seed' | 'seedling';
  onSetStage: (stage: 'seed' | 'seedling') => void;
  // View mode
  useIsometric: boolean;
  onToggleIsometric: () => void;
  // Snap
  snapToGrid: boolean;
  onToggleSnap: () => void;
  // Plot size
  widthM: number;
  heightM: number;
  unit: 'meters' | 'feet';
  onSetWidth: (w: number) => void;
  onSetHeight: (h: number) => void;
  onToggleUnit: () => void;
  // Lock
  canvasLocked: boolean;
  onToggleLock: () => void;
  // Compass
  southDirection: number;
  onSetDirection: (d: number) => void;
  // Other
  plantCount: number;
  onClear: () => void;
  // Saving
  isSaving: boolean;
  showSaved: boolean;
}

const COMPASS_DIRECTIONS = [
  { label: 'N', value: 0 },
  { label: 'NE', value: 45 },
  { label: 'E', value: 90 },
  { label: 'SE', value: 135 },
  { label: 'S', value: 180 },
  { label: 'SW', value: 225 },
  { label: 'W', value: 270 },
  { label: 'NW', value: 315 },
];

const MobileToolbar: React.FC<MobileToolbarProps> = ({
  undoCount,
  redoCount,
  onUndo,
  onRedo,
  cellSizePx,
  onZoomIn,
  onZoomOut,
  defaultStage,
  onSetStage,
  useIsometric,
  onToggleIsometric,
  snapToGrid,
  onToggleSnap,
  widthM,
  heightM,
  unit,
  onSetWidth,
  onSetHeight,
  onToggleUnit,
  canvasLocked,
  onToggleLock,
  southDirection,
  onSetDirection,
  plantCount,
  onClear,
  isSaving,
  showSaved,
}) => {
  const [moreOpen, setMoreOpen] = useState(false);

  const zoomPercent = Math.round((cellSizePx / 40) * 100);

  return (
    <div className="flex items-center justify-between gap-1 px-2 h-14 bg-card border-b border-border shadow-sm">
      {/* Undo / Redo */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="w-11 h-11 min-w-[44px] min-h-[44px]"
          onClick={onUndo}
          disabled={undoCount === 0}
          aria-label={`Undo (${undoCount} available)`}
        >
          <Undo2 className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="w-11 h-11 min-w-[44px] min-h-[44px]"
          onClick={onRedo}
          disabled={redoCount === 0}
          aria-label={`Redo (${redoCount} available)`}
        >
          <Redo2 className="w-5 h-5" />
        </Button>
      </div>

      {/* Zoom controls */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="w-11 h-11 min-w-[44px] min-h-[44px]"
          onClick={onZoomOut}
          aria-label="Zoom out"
        >
          <Minus className="w-5 h-5" />
        </Button>
        <span className="text-xs font-medium w-10 text-center select-none">
          {zoomPercent}%
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="w-11 h-11 min-w-[44px] min-h-[44px]"
          onClick={onZoomIn}
          aria-label="Zoom in"
        >
          <Plus className="w-5 h-5" />
        </Button>
      </div>

      {/* Save status indicator */}
      <div className="flex items-center w-6 justify-center">
        {isSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        {showSaved && !isSaving && <Check className="w-4 h-4 text-green-600 dark:text-green-400" />}
      </div>

      {/* More button with popover */}
      <Popover open={moreOpen} onOpenChange={setMoreOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-11 h-11 min-w-[44px] min-h-[44px] p-0"
            aria-label="More controls"
          >
            <Settings2 className="w-5 h-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-80 p-4"
          align="end"
          sideOffset={8}
        >
          <div className="grid grid-cols-2 gap-3">
            {/* Planting Stage */}
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Planting Stage
              </label>
              <div className="flex gap-1">
                <Button
                  variant={defaultStage === 'seed' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 h-9"
                  onClick={() => onSetStage('seed')}
                >
                  Seed
                </Button>
                <Button
                  variant={defaultStage === 'seedling' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 h-9"
                  onClick={() => onSetStage('seedling')}
                >
                  Seedling
                </Button>
              </div>
            </div>

            {/* View Mode */}
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                View Mode
              </label>
              <div className="flex gap-1">
                <Button
                  variant={!useIsometric ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 h-9"
                  onClick={() => { if (useIsometric) onToggleIsometric(); }}
                >
                  Flat
                </Button>
                <Button
                  variant={useIsometric ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 h-9"
                  onClick={() => { if (!useIsometric) onToggleIsometric(); }}
                >
                  Isometric
                </Button>
              </div>
            </div>

            {/* Snap to Grid */}
            <div className="flex items-center justify-between col-span-1 p-2 rounded-md border">
              <div className="flex items-center gap-1.5">
                <Grid3X3 className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium">Snap</span>
              </div>
              <Button
                variant={snapToGrid ? 'default' : 'outline'}
                size="sm"
                className="h-7 w-12 text-xs"
                onClick={onToggleSnap}
              >
                {snapToGrid ? 'On' : 'Off'}
              </Button>
            </div>

            {/* Canvas Lock */}
            <div className="flex items-center justify-between col-span-1 p-2 rounded-md border">
              <div className="flex items-center gap-1.5">
                {canvasLocked ? (
                  <Lock className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Unlock className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-xs font-medium">Lock</span>
              </div>
              <Button
                variant={canvasLocked ? 'default' : 'outline'}
                size="sm"
                className="h-7 w-12 text-xs"
                onClick={onToggleLock}
              >
                {canvasLocked ? 'On' : 'Off'}
              </Button>
            </div>

            {/* Plot Size */}
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Plot Size ({unit === 'meters' ? 'm' : 'ft'})
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={widthM}
                  onChange={(e) => onSetWidth(Number(e.target.value))}
                  className="w-16 h-9 rounded-md border border-border bg-background text-foreground px-2 text-sm text-center"
                  aria-label="Plot width"
                />
                <span className="text-xs text-muted-foreground">&times;</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={heightM}
                  onChange={(e) => onSetHeight(Number(e.target.value))}
                  className="w-16 h-9 rounded-md border border-border bg-background text-foreground px-2 text-sm text-center"
                  aria-label="Plot height"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs ml-auto"
                  onClick={onToggleUnit}
                >
                  {unit === 'meters' ? 'm' : 'ft'}
                </Button>
              </div>
            </div>

            {/* Compass Direction */}
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                <Compass className="w-3.5 h-3.5 inline-block mr-1" />
                South Facing Direction
              </label>
              <div className="grid grid-cols-4 gap-1">
                {COMPASS_DIRECTIONS.map((dir) => (
                  <Button
                    key={dir.value}
                    variant={southDirection === dir.value ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => onSetDirection(dir.value)}
                  >
                    {dir.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Clear */}
            <div className="col-span-2 pt-2 border-t">
              <Button
                variant="destructive"
                size="sm"
                className="w-full h-9"
                onClick={() => {
                  onClear();
                  setMoreOpen(false);
                }}
                disabled={plantCount === 0}
              >
                <RotateCcw className="w-4 h-4 mr-1.5" />
                Clear All ({plantCount} plants)
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default MobileToolbar;
