import { useState } from 'react';
import { PlacedPlant } from '@/types/garden';
import { getPlantById, rotationGroupLabels, rotationGroupColors } from '@/data/plants';
import { getCompanionReason } from '@/data/companionReasons';
import { Badge } from '@/components/ui/badge';
import { generateId } from '@/lib/uuid';
import { X, Check, AlertTriangle, Timer, Sprout, Sun, CloudSun, Cloud, Layers, Ruler, CalendarPlus, Camera } from 'lucide-react';
import { PhotoGallery } from '@/components/PhotoGallery';
import { CameraCapture } from '@/components/CameraCapture';
import { savePhoto } from '@/lib/photoStorage';
import { sunExposureLabels } from '@/utils/sunCalculator';
import { getSuccessionSuggestions } from '@/utils/successionPlanting';
import { suggestBedSizeForPlant } from '@/utils/bedPlantSuggestions';

interface PlantInfoPanelProps {
  placed: PlacedPlant;
  allPlaced: PlacedPlant[];
  onClose: () => void;
  onRemove: (id: string) => void;
  sunExposure?: 'full-sun' | 'partial-shade' | 'full-shade';
  onAddSuccessionTask?: (title: string, description: string) => void;
  onUpdatePlaced?: (updated: PlacedPlant) => void;
  modal?: boolean;
}

export function PlantInfoPanel({ placed, allPlaced, onClose, onRemove, sunExposure, onAddSuccessionTask, onUpdatePlaced, modal }: PlantInfoPanelProps) {
  const plant = getPlantById(placed.plantId);
  if (!plant) return null;

  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const handlePhotoCapture = async (photoDataUrl: string) => {
    // Note: In a full implementation, we'd pass the gardenId
    // For now, we'll just update the placed plant with the new photo
    if (onUpdatePlaced) {
      const newPhoto = {
        id: generateId(),
        dataUrl: photoDataUrl,
        timestamp: Date.now(),
      };
      const updated = {
        ...placed,
        photos: [...(placed.photos || []), newPhoto],
      };
      onUpdatePlaced(updated);
    }
  };

  const handleDeletePhoto = (photoId: string) => {
    if (onUpdatePlaced) {
      const updated = {
        ...placed,
        photos: (placed.photos || []).filter(p => p.id !== photoId),
      };
      onUpdatePlaced(updated);
    }
  };


  // Check companions and enemies in the garden
  const placedPlantIds = [...new Set(allPlaced.filter(p => p.id !== placed.id).map(p => p.plantId))];
  const activeCompanions = plant.companions.filter(c => placedPlantIds.includes(c));
  const activeEnemies = plant.enemies.filter(e => placedPlantIds.includes(e));
  const activeCompanionDetails = activeCompanions
    .map(id => {
      const related = getPlantById(id);
      if (!related) return null;
      return {
        id,
        name: related.name,
        emoji: related.emoji,
        reason: getCompanionReason(plant.id, id),
      };
    })
    .filter(Boolean) as Array<{ id: string; name: string; emoji: string; reason?: string }>;
  const activeEnemyDetails = activeEnemies
    .map(id => {
      const related = getPlantById(id);
      if (!related) return null;
      return {
        id,
        name: related.name,
        emoji: related.emoji,
        reason: getCompanionReason(plant.id, id),
      };
    })
    .filter(Boolean) as Array<{ id: string; name: string; emoji: string; reason?: string }>;

  const sunLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    'full-sun': { label: 'Full Sun', icon: <Sun className="h-3 w-3" />, color: '#f59e0b' },
    'partial-shade': { label: 'Partial Shade', icon: <CloudSun className="h-3 w-3" />, color: '#3b82f6' },
    'full-shade': { label: 'Full Shade', icon: <Cloud className="h-3 w-3" />, color: '#6b7280' },
    'any': { label: 'Any Light', icon: <Layers className="h-3 w-3" />, color: '#10b981' },
  };
  const sunInfo = plant.sunPreference ? sunLabels[plant.sunPreference] : null;

  const panelContent = (
    <div className="w-full">
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

      {/* Planted date & stage */}
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {placed.plantedAt && (
          <div className="bg-muted rounded-md px-2 py-1.5 flex items-center gap-1">
            <span className="text-muted-foreground">📅 Planted:</span>
            <span className="font-medium text-foreground">{new Date(placed.plantedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        )}
        <div className="bg-muted rounded-md px-2 py-1.5 flex items-center gap-1">
          <span>{placed.stage === 'seedling' ? '🌱' : '🌰'}</span>
          <span className="font-medium text-foreground capitalize">{placed.stage || 'seed'}</span>
        </div>
        {placed.plantedAt && plant.daysToHarvest && (
          <div className="bg-muted rounded-md px-2 py-1.5 flex items-center gap-1">
            <span className="text-muted-foreground">🌾 Est. harvest:</span>
            <span className="font-medium text-foreground">
              {new Date(new Date(placed.plantedAt).getTime() + plant.daysToHarvest * 86400000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        )}
      </div>

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
      {activeEnemyDetails.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-2 mb-3 text-xs text-destructive">
          <p className="font-medium">⚠️ Rotation Warning</p>
          <div className="space-y-1 mt-1.5">
            {activeEnemyDetails.map(enemy => (
              <p key={enemy.id}>
                {enemy.emoji} <strong>{enemy.name}:</strong> {enemy.reason || 'Poor neighbour nearby.'}
              </p>
            ))}
          </div>
        </div>
      )}

      {activeCompanionDetails.length > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-md p-2 mb-3 text-xs text-primary">
          <p className="font-medium">🌟 Great pairing!</p>
          <div className="space-y-1 mt-1.5">
            {activeCompanionDetails.map(companion => (
              <p key={companion.id}>
                {companion.emoji} <strong>{companion.name}:</strong> {companion.reason || 'Helpful companion nearby.'}
              </p>
            ))}
          </div>
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

      {/* Suggested bed sizes */}
      <div className="bg-muted/50 border border-border rounded-md p-2 mb-3 text-xs">
        <p className="font-medium text-foreground mb-1.5 flex items-center gap-1">
          <Ruler className="h-3 w-3 text-primary" /> Ideal bed sizes
        </p>
        <div className="grid grid-cols-2 gap-1">
          {suggestBedSizeForPlant(plant).map(s => (
            <div key={s.label} className="bg-background rounded px-2 py-1.5 border border-border/50">
              <p className="font-semibold text-foreground">{s.label}</p>
              <p className="text-muted-foreground text-[10px]">{s.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Succession planting suggestions */}
      {plant.harvest && (
        <div className="bg-accent/10 border border-accent/20 rounded-md p-2 mb-3 text-xs">
          <p className="font-medium text-foreground mb-1.5">🔄 Follow-on crops</p>
          <p className="text-muted-foreground text-[10px] mb-1">What to plant after {plant.name} finishes ({plant.harvest}):</p>
          <div className="space-y-1">
            {getSuccessionSuggestions(plant.id).map(s => (
              <div key={s.plant.id} className="flex items-center gap-1.5">
                <span>{s.plant.emoji}</span>
                <span className="font-medium text-foreground">{s.plant.name}</span>
                <span className="text-muted-foreground text-[9px] flex-1">— {s.reason}</span>
                {onAddSuccessionTask && (
                  <button
                    onClick={() => onAddSuccessionTask(
                      `Plant ${s.plant.name} after ${plant.name}`,
                      `${s.reason}. Harvest ${plant.name} ends ${plant.harvest}, then sow ${s.plant.name}.`
                    )}
                    className="shrink-0 h-4 w-4 rounded bg-primary/15 text-primary flex items-center justify-center hover:bg-primary/25 transition-colors"
                    title="Add to tasks"
                  >
                    <CalendarPlus className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            ))}
            {getSuccessionSuggestions(plant.id).length === 0 && (
              <p className="text-muted-foreground italic">No follow-on crops found for this season</p>
            )}
          </div>
        </div>
      )}

      {/* Photos section */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-medium text-foreground">📷 Photos</h4>
          {onUpdatePlaced && (
            <button
              onClick={() => setIsCameraOpen(true)}
              className="p-1 rounded hover:bg-muted text-primary text-xs flex items-center gap-1"
              title="Take a photo"
            >
              <Camera className="w-3 h-3" />
              Add
            </button>
          )}
        </div>
        <PhotoGallery
          photos={placed.photos}
          onImageDelete={handleDeletePhoto}
          readOnly={!onUpdatePlaced}
        />
      </div>

      <button
        onClick={() => onRemove(placed.id)}
        className="w-full text-xs py-2 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
      >
        Remove from garden
      </button>

      {/* Camera capture modal */}
      <CameraCapture
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handlePhotoCapture}
        title={`Photograph ${plant.name}`}
        description={`Take a photo of your ${plant.name} plant`}
      />
    </div>
  );

  // Render as modal on sm-md, as sidebar on lg+
  if (modal) {
    return (
      <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
        <div className="bg-card rounded-t-xl sm:rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-fade-in p-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between mb-3">
            <h3 className="font-semibold text-foreground">{plant.name}</h3>
            <button onClick={onClose} className="p-1 rounded hover:bg-muted">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          {panelContent}
        </div>
      </div>
    );
  }

  return (
    <div className="hidden lg:block w-72 border-l border-border bg-card p-4 overflow-y-auto animate-fade-in">
      {panelContent}
    </div>
  );
}
