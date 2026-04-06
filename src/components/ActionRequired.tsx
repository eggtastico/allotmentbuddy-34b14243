import { useMemo } from 'react';
import { PlacedPlant } from '@/types/garden';
import { plants as plantDB } from '@/data/plants';
import { AlertTriangle, Clock, Sprout } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface ActionRequiredProps {
  placedPlants: PlacedPlant[];
}

export function ActionRequired({ placedPlants }: ActionRequiredProps) {
  const now = new Date();

  const cropData = useMemo(() => {
    // Group by plantId, use earliest plantedAt
    const groups = new Map<string, { plantId: string; plantedAt: Date; count: number }>();
    for (const pp of placedPlants) {
      const existing = groups.get(pp.plantId);
      const d = new Date(pp.plantedAt);
      if (!existing || d < existing.plantedAt) {
        groups.set(pp.plantId, { plantId: pp.plantId, plantedAt: d, count: (existing?.count || 0) + 1 });
      } else {
        existing.count++;
      }
    }

    return Array.from(groups.values()).map(g => {
      const plant = plantDB.find(p => p.id === g.plantId);
      if (!plant) return null;
      const daysElapsed = Math.floor((now.getTime() - g.plantedAt.getTime()) / 86400000);
      const daysToHarvest = plant.daysToHarvest || 90;
      const progress = Math.min(100, Math.round((daysElapsed / daysToHarvest) * 100));
      const daysSincePlanted = daysElapsed;
      // "Stale" = planted > 7 days ago — we treat all as needing attention check
      const needsAttention = daysElapsed >= 7;
      const daysRemaining = Math.max(0, daysToHarvest - daysElapsed);
      const harvestReady = daysElapsed >= daysToHarvest;

      return {
        ...g,
        plant,
        daysElapsed,
        daysToHarvest,
        progress,
        needsAttention,
        daysRemaining,
        harvestReady,
        daysSincePlanted,
      };
    }).filter(Boolean) as NonNullable<ReturnType<typeof Array.prototype.map>[number]>[];
  }, [placedPlants]);

  const attentionCrops = cropData.filter(c => c.needsAttention);
  const readyToHarvest = cropData.filter(c => c.harvestReady);

  if (cropData.length === 0) return null;

  return (
    <div className="border-b border-border bg-card/80 backdrop-blur-sm">
      {/* Action Required Banner */}
      {(attentionCrops.length > 0 || readyToHarvest.length > 0) && (
        <div className="px-4 py-2 bg-accent/10 border-b border-accent/20">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className="h-4 w-4 text-accent" />
            <span className="text-xs font-semibold text-accent">Action Required</span>
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              {attentionCrops.length + readyToHarvest.length}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {readyToHarvest.map(c => (
              <div key={`harvest-${c.plantId}`} className="flex items-center gap-1 bg-primary/15 text-primary rounded-full px-2 py-0.5 text-[10px] font-medium">
                <span>{c.plant.emoji}</span>
                <span>{c.plant.name}</span>
                <Badge className="h-3.5 text-[9px] px-1 bg-primary text-primary-foreground">Ready!</Badge>
              </div>
            ))}
            {attentionCrops.filter(c => !c.harvestReady).map(c => (
              <div key={`attention-${c.plantId}`} className="flex items-center gap-1 bg-accent/15 text-accent-foreground rounded-full px-2 py-0.5 text-[10px] font-medium">
                <span>{c.plant.emoji}</span>
                <span>{c.plant.name}</span>
                <span className="text-muted-foreground">({c.daysSincePlanted}d ago)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress Bars */}
      <div className="px-4 py-2">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Sprout className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-semibold text-foreground">Crop Progress</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-3 gap-y-1.5">
          {cropData.map(c => (
            <div key={c.plantId} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-foreground truncate">
                  {c.plant.emoji} {c.plant.name}
                  {c.count > 1 && <span className="text-muted-foreground"> ×{c.count}</span>}
                </span>
                <span className="text-[9px] text-muted-foreground ml-1 shrink-0">
                  {c.harvestReady ? '🎉' : `${c.daysRemaining}d`}
                </span>
              </div>
              <Progress
                value={c.progress}
                className={`h-1.5 ${c.harvestReady ? '[&>div]:bg-primary' : c.progress > 75 ? '[&>div]:bg-accent' : ''}`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
