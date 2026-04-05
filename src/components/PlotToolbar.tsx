import { PlotSettings } from '@/types/garden';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Minus, Plus, RotateCcw, Compass } from 'lucide-react';

interface PlotToolbarProps {
  settings: PlotSettings;
  onSettingsChange: (s: PlotSettings) => void;
  plantCount: number;
  onClear: () => void;
}

const gridSizeOptions = [
  { value: 10, label: '10 cm' },
  { value: 20, label: '20 cm' },
  { value: 25, label: '25 cm' },
  { value: 50, label: '50 cm' },
];

const compassOptions = [
  { value: 0, label: '⬆ North' },
  { value: 45, label: '↗ NE' },
  { value: 90, label: '➡ East' },
  { value: 135, label: '↘ SE' },
  { value: 180, label: '⬇ South' },
  { value: 225, label: '↙ SW' },
  { value: 270, label: '⬅ West' },
  { value: 315, label: '↖ NW' },
];

export function PlotToolbar({ settings, onSettingsChange, plantCount, onClear }: PlotToolbarProps) {
  const label = settings.unit === 'meters' ? 'm' : 'ft';

  return (
    <div className="h-12 border-b border-border bg-card px-4 flex items-center gap-4 text-sm flex-wrap">
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

      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground text-xs">Grid:</span>
        <select
          value={settings.cellSizeCm}
          onChange={e => onSettingsChange({ ...settings, cellSizeCm: Number(e.target.value) })}
          className="h-7 text-xs rounded border border-input bg-background px-2 text-foreground"
        >
          {gridSizeOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="h-5 w-px bg-border" />

      <div className="flex items-center gap-1.5">
        <Compass className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground text-xs">South:</span>
        <select
          value={settings.southDirection}
          onChange={e => onSettingsChange({ ...settings, southDirection: Number(e.target.value) })}
          className="h-7 text-xs rounded border border-input bg-background px-2 text-foreground"
        >
          {compassOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
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
