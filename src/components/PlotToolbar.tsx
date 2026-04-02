import { PlotSettings } from '@/types/garden';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Minus, Plus, RotateCcw } from 'lucide-react';

interface PlotToolbarProps {
  settings: PlotSettings;
  onSettingsChange: (s: PlotSettings) => void;
  plantCount: number;
  onClear: () => void;
}

export function PlotToolbar({ settings, onSettingsChange, plantCount, onClear }: PlotToolbarProps) {
  const label = settings.unit === 'meters' ? 'm' : 'ft';

  return (
    <div className="h-12 border-b border-border bg-card px-4 flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground text-xs">Plot:</span>
        <Input
          type="number"
          value={settings.widthM}
          onChange={e => onSettingsChange({ ...settings, widthM: Math.max(1, Number(e.target.value)) })}
          className="w-14 h-7 text-xs text-center"
          min={1}
          max={50}
        />
        <span className="text-muted-foreground">×</span>
        <Input
          type="number"
          value={settings.heightM}
          onChange={e => onSettingsChange({ ...settings, heightM: Math.max(1, Number(e.target.value)) })}
          className="w-14 h-7 text-xs text-center"
          min={1}
          max={50}
        />
        <button
          onClick={() => onSettingsChange({ ...settings, unit: settings.unit === 'meters' ? 'feet' : 'meters' })}
          className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground font-medium"
        >
          {label}
        </button>
      </div>

      <div className="h-5 w-px bg-border" />

      <div className="flex items-center gap-1">
        <span className="text-muted-foreground text-xs">Zoom:</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onSettingsChange({ ...settings, cellSizePx: Math.max(16, settings.cellSizePx - 4) })}>
          <Minus className="h-3 w-3" />
        </Button>
        <span className="text-xs w-8 text-center text-foreground">{settings.cellSizePx}px</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onSettingsChange({ ...settings, cellSizePx: Math.min(64, settings.cellSizePx + 4) })}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      <div className="h-5 w-px bg-border" />

      <span className="text-xs text-muted-foreground">🌱 {plantCount} planted</span>

      <div className="ml-auto">
        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={onClear}>
          <RotateCcw className="h-3 w-3 mr-1" />
          Clear
        </Button>
      </div>
    </div>
  );
}
