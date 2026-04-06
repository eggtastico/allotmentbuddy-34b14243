import { useMemo } from 'react';
import { PlacedPlant } from '@/types/garden';
import { plants as plantDB } from '@/data/plants';
import { AlertTriangle, Sprout, Droplets, Scissors, Apple } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface ActionRequiredProps {
  placedPlants: PlacedPlant[];
}

export function ActionRequired({ placedPlants }: ActionRequiredProps) {
  const now = new Date();

  const cropData = useMemo(() => {
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
        daysSincePlanted: daysElapsed,
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
  }, [placedPlants]);

  const attentionCrops = cropData.filter(c => c.needsAttention);
  const readyToHarvest = cropData.filter(c => c.harvestReady);

  if (cropData.length === 0) return null;

  return (
    <div className="border-b border-border bg-background/50 backdrop-blur-sm">
      {/* Action Required Banner */}
      {(attentionCrops.length > 0 || readyToHarvest.length > 0) && (
        <div className="px-4 py-2.5 bg-accent/10 border-b border-accent/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-accent" />
            <span className="text-xs font-bold text-accent">Action Required</span>
            <Badge variant="secondary" className="text-[10px] h-5 px-2 rounded-full font-bold">
              {attentionCrops.length + readyToHarvest.length}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {readyToHarvest.map(c => (
              <div key={`harvest-${c.plantId}`} className="flex items-center gap-1.5 glass-card rounded-2xl px-3 py-1.5 text-[11px] font-semibold">
                <span className="text-base">{c.plant.emoji}</span>
                <span>{c.plant.name}</span>
                <Badge className="h-4 text-[9px] px-1.5 bg-primary text-primary-foreground rounded-full">Ready!</Badge>
              </div>
            ))}
            {attentionCrops.filter(c => !c.harvestReady).map(c => (
              <div key={`attention-${c.plantId}`} className="flex items-center gap-1.5 glass-card rounded-2xl px-3 py-1.5 text-[11px] font-semibold">
                <span className="text-base">{c.plant.emoji}</span>
                <span>{c.plant.name}</span>
                <span className="text-muted-foreground">({c.daysSincePlanted}d)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Glassmorphism Crop Cards */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Sprout className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold text-foreground">Crop Progress</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
          {cropData.map(c => (
            <div key={c.plantId} className="glass-card rounded-2xl p-3 flex flex-col gap-2 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2">
                <span className="text-xl">{c.plant.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">{c.plant.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {c.count > 1 && `×${c.count} · `}
                    {c.harvestReady ? '🎉 Harvest!' : `${c.daysRemaining}d left`}
                  </p>
                </div>
              </div>
              <Progress
                value={c.progress}
                className={`h-2 rounded-full ${c.harvestReady ? '[&>div]:bg-primary' : c.progress > 75 ? '[&>div]:bg-accent' : '[&>div]:bg-secondary'}`}
              />
              {/* Quick action icon toggles */}
              <div className="flex items-center gap-1 mt-0.5">
                <button className="h-8 w-8 min-h-[32px] min-w-[32px] rounded-xl flex items-center justify-center bg-info/10 hover:bg-info/20 transition-colors" title="Watered">
                  <Droplets className="h-4 w-4 text-info" />
                </button>
                <button className="h-8 w-8 min-h-[32px] min-w-[32px] rounded-xl flex items-center justify-center bg-primary/10 hover:bg-primary/20 transition-colors" title="Weeded">
                  <Scissors className="h-4 w-4 text-primary" />
                </button>
                <button className="h-8 w-8 min-h-[32px] min-w-[32px] rounded-xl flex items-center justify-center bg-accent/10 hover:bg-accent/20 transition-colors" title="Harvested">
                  <Apple className="h-4 w-4 text-accent" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
