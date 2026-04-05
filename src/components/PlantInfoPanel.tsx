import { PlacedPlant } from '@/types/garden';
import { getPlantById, rotationGroupLabels, rotationGroupColors } from '@/data/plants';
import { Badge } from '@/components/ui/badge';
import { X, Check, AlertTriangle, Timer, Sprout, Sun, CloudSun, Cloud, Layers } from 'lucide-react';
import { sunExposureLabels } from '@/utils/sunCalculator';

interface PlantInfoPanelProps {
  placed: PlacedPlant;
  allPlaced: PlacedPlant[];
  onClose: () => void;
  onRemove: (id: string) => void;
  sunExposure?: 'full-sun' | 'partial-shade' | 'full-shade';
}

export function PlantInfoPanel({ placed, allPlaced, onClose, onRemove, sunExposure }: PlantInfoPanelProps) {
  const plant = getPlantById(placed.plantId);
  if (!plant) return null;

  // Check companions and enemies in the garden
  const placedPlantIds = [...new Set(allPlaced.filter(p => p.id !== placed.id).map(p => p.plantId))];
  const activeCompanions = plant.companions.filter(c => placedPlantIds.includes(c));
  const activeEnemies = plant.enemies.filter(e => placedPlantIds.includes(e));

  const sunLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    'full-sun': { label: 'Full Sun', icon: <Sun className="h-3 w-3" />, color: '#f59e0b' },
    'partial-shade': { label: 'Partial Shade', icon: <CloudSun className="h-3 w-3" />, color: '#3b82f6' },
    'full-shade': { label: 'Full Shade', icon: <Cloud className="h-3 w-3" />, color: '#6b7280' },
    'any': { label: 'Any Light', icon: <Layers className="h-3 w-3" />, color: '#10b981' },
  };
  const sunInfo = plant.sunPreference ? sunLabels[plant.sunPreference] : null;

  return (
    <div className="w-72 border-l border-border bg-card p-4 overflow-y-auto animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-3xl">{plant.emoji}</span>
          <div>
            <h3 className="font-semibold text-foreground">{plant.name}</h3>
            <p className="text-xs text-muted-foreground capitalize">{plant.category}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-muted">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Rotation group & Sun preference */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Badge
          className="text-xs"
          style={{ backgroundColor: rotationGroupColors[plant.rotationGroup] + '22', color: rotationGroupColors[plant.rotationGroup], borderColor: rotationGroupColors[plant.rotationGroup] + '44' }}
          variant="outline"
        >
          {rotationGroupLabels[plant.rotationGroup]}
        </Badge>
        {sunInfo && (
          <Badge
            className="text-xs flex items-center gap-1"
            style={{ backgroundColor: sunInfo.color + '22', color: sunInfo.color, borderColor: sunInfo.color + '44' }}
            variant="outline"
          >
            {sunInfo.icon} {sunInfo.label}
          </Badge>
        )}
      </div>

      {/* Key info */}
      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        {plant.spacingCm && (
          <div className="bg-muted rounded-md p-2">
            <p className="text-muted-foreground">Spacing</p>
            <p className="font-medium text-foreground">{plant.spacingCm} cm</p>
          </div>
        )}
        {plant.daysToHarvest && (
          <div className="bg-muted rounded-md p-2">
            <p className="text-muted-foreground flex items-center gap-1"><Timer className="h-3 w-3" /> Days</p>
            <p className="font-medium text-foreground">{plant.daysToHarvest}</p>
          </div>
        )}
        {plant.sowIndoors && (
          <div className="bg-muted rounded-md p-2">
            <p className="text-muted-foreground">Sow indoors</p>
            <p className="font-medium text-foreground">{plant.sowIndoors}</p>
          </div>
        )}
        {plant.sowOutdoors && (
          <div className="bg-muted rounded-md p-2">
            <p className="text-muted-foreground">Sow outdoors</p>
            <p className="font-medium text-foreground">{plant.sowOutdoors}</p>
          </div>
        )}
        {plant.harvest && (
          <div className="bg-muted rounded-md p-2">
            <p className="text-muted-foreground">Harvest</p>
            <p className="font-medium text-foreground">{plant.harvest}</p>
          </div>
        )}
        {plant.yieldPerPlant && (
          <div className="bg-muted rounded-md p-2">
            <p className="text-muted-foreground flex items-center gap-1"><Sprout className="h-3 w-3" /> Yield</p>
            <p className="font-medium text-foreground">{plant.yieldPerPlant}</p>
          </div>
        )}
      </div>

      {/* Companions */}
      <div className="mb-3">
        <h4 className="text-xs font-medium text-foreground mb-1 flex items-center gap-1">
          <Check className="h-3 w-3 text-primary" /> Good Companions
        </h4>
        <div className="flex flex-wrap gap-1">
          {plant.companions.length > 0 ? plant.companions.map(c => {
            const companion = getPlantById(c);
            const isActive = activeCompanions.includes(c);
            return (
              <Badge key={c} variant={isActive ? "default" : "outline"} className="text-xs">
                {companion ? `${companion.emoji} ${companion.name}` : c}
                {isActive && ' ✓'}
              </Badge>
            );
          }) : <p className="text-xs text-muted-foreground">None documented</p>}
        </div>
      </div>

      {/* Enemies */}
      <div className="mb-3">
        <h4 className="text-xs font-medium text-foreground mb-1 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3 text-destructive" /> Avoid Nearby
        </h4>
        <div className="flex flex-wrap gap-1">
          {plant.enemies.length > 0 ? plant.enemies.map(e => {
            const enemy = getPlantById(e);
            const isActive = activeEnemies.includes(e);
            return (
              <Badge key={e} variant={isActive ? "destructive" : "outline"} className="text-xs">
                {enemy ? `${enemy.emoji} ${enemy.name}` : e}
                {isActive && ' ⚠️'}
              </Badge>
            );
          }) : <p className="text-xs text-muted-foreground">No conflicts</p>}
        </div>
      </div>

      {/* Active warnings */}
      {activeEnemies.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-2 mb-3 text-xs text-destructive">
          <p className="font-medium">⚠️ Rotation Warning</p>
          <p>This plant has {activeEnemies.length} enemy plant{activeEnemies.length > 1 ? 's' : ''} nearby in your garden!</p>
        </div>
      )}

      {activeCompanions.length > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-md p-2 mb-3 text-xs text-primary">
          <p className="font-medium">🌟 Great pairing!</p>
          <p>{activeCompanions.length} companion plant{activeCompanions.length > 1 ? 's' : ''} nearby.</p>
        </div>
      )}

      {/* Sun exposure warning */}
      {sunExposure && plant.sunPreference && plant.sunPreference !== 'any' && sunExposure !== plant.sunPreference && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-2 mb-3 text-xs text-amber-700">
          <p className="font-medium">☀️ Sun Mismatch</p>
          <p>This plant prefers <strong>{plant.sunPreference.replace('-', ' ')}</strong> but is currently in <strong>{sunExposure.replace('-', ' ')}</strong>. Consider moving it!</p>
        </div>
      )}

      {sunExposure && (
        <div className="bg-muted rounded-md p-2 mb-3 text-xs">
          <p className="text-muted-foreground">Position sun exposure</p>
          <p className="font-medium text-foreground">{sunExposureLabels[sunExposure]}</p>
        </div>
      )}

      {plant.notes && (
        <div className="bg-accent/10 border border-accent/20 rounded-md p-2 mb-3 text-xs text-accent-foreground">
          <p className="font-medium">📝 Note</p>
          <p>{plant.notes}</p>
        </div>
      )}

      <button
        onClick={() => onRemove(placed.id)}
        className="w-full text-xs py-2 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
      >
        Remove from garden
      </button>
    </div>
  );
}
