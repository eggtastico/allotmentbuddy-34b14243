import { useMemo, useState } from 'react';
import { PlacedPlant } from '@/types/garden';
import { plants as plantDB } from '@/data/plants';
import { Sprout, ChevronDown, ChevronUp } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface ActionRequiredProps {
  placedPlants: PlacedPlant[];
}

interface CropStatus {
  label: string;
  badgeClass: string;
  progressClass: string;
  needsAttention: boolean;
  message: string;
}

function getCropStatus(
  daysElapsed: number,
  daysToHarvest: number,
  isEstablished: boolean,
  plantTips?: string,
): CropStatus {
  if (isEstablished) {
    return {
      label: 'Perennial',
      badgeClass: 'bg-primary/15 text-primary',
      progressClass: '[&>div]:bg-primary/40',
      needsAttention: false,
      message: plantTips ? plantTips.split('.')[0] + '.' : 'Ongoing care — water and feed as needed.',
    };
  }

  const daysRemaining = Math.max(0, daysToHarvest - daysElapsed);
  const progress = Math.min(100, Math.round((daysElapsed / daysToHarvest) * 100));

  if (daysElapsed >= daysToHarvest) {
    return {
      label: 'Harvest now!',
      badgeClass: 'bg-green-500/20 text-green-700 dark:text-green-400',
      progressClass: '[&>div]:bg-green-500',
      needsAttention: true,
      message: 'This crop is ready — harvest soon to avoid bolting or spoiling.',
    };
  }

  if (daysRemaining <= 7) {
    return {
      label: `${daysRemaining}d to harvest`,
      badgeClass: 'bg-amber-500/20 text-amber-700 dark:text-amber-400',
      progressClass: '[&>div]:bg-amber-500',
      needsAttention: true,
      message: `Nearly ready — check daily. Harvest when it looks right; don't wait too long.`,
    };
  }

  if (daysElapsed < 14) {
    return {
      label: 'Just planted',
      badgeClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
      progressClass: '[&>div]:bg-blue-400',
      needsAttention: false,
      message: 'New planting — keep soil moist, protect from slugs and birds.',
    };
  }

  if (progress < 50) {
    return {
      label: `${daysRemaining}d left`,
      badgeClass: 'bg-muted text-muted-foreground',
      progressClass: '[&>div]:bg-secondary',
      needsAttention: false,
      message: `Growing well — about ${daysRemaining} days until harvest.${plantTips ? ' ' + plantTips.split('.')[0] + '.' : ''}`,
    };
  }

  return {
    label: `${daysRemaining}d left`,
    badgeClass: 'bg-accent/15 text-accent',
    progressClass: '[&>div]:bg-accent',
    needsAttention: false,
    message: `More than halfway — ${daysRemaining} days to go. Keep watering and watch for pests.`,
  };
}

export function ActionRequired({ placedPlants }: ActionRequiredProps) {
  const [collapsed, setCollapsed] = useState(true);

  const cropData = useMemo(() => {
    const now = new Date();
    // Group placed plants by plantId, keeping the earliest planting date
    const groups = new Map<string, { plantId: string; plantedAt: Date; count: number; isEstablished: boolean }>();
    for (const pp of placedPlants) {
      const existing = groups.get(pp.plantId);
      const d = new Date(pp.plantedAt);
      const established = pp.stage === 'established';
      if (!existing || d < existing.plantedAt) {
        groups.set(pp.plantId, {
          plantId: pp.plantId,
          plantedAt: d,
          count: (existing?.count ?? 0) + 1,
          isEstablished: established,
        });
      } else {
        existing.count++;
        if (established) existing.isEstablished = true;
      }
    }

    return Array.from(groups.values()).flatMap(g => {
      const plant = plantDB.find(p => p.id === g.plantId);
      if (!plant) return [];
      const daysElapsed = Math.floor((now.getTime() - g.plantedAt.getTime()) / 86400000);
      const daysToHarvest = plant.daysToHarvest ?? 90;
      const progress = Math.min(100, Math.round((daysElapsed / daysToHarvest) * 100));
      const status = getCropStatus(daysElapsed, daysToHarvest, g.isEstablished, plant.tips);
      return [{ ...g, plant, daysElapsed, daysToHarvest, progress, status }];
    });
  }, [placedPlants]);

  if (cropData.length === 0) return null;

  const attentionItems = cropData.filter(c => c.status.needsAttention);

  return (
    <div className="border-t border-border bg-background/50 backdrop-blur-sm">
      {/* Header */}
      <button
        className="w-full px-4 py-2 flex items-center gap-2 hover:bg-muted/50 transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <Sprout className="h-4 w-4 text-primary flex-shrink-0" />
        <span className="text-xs font-bold text-foreground">Crop Progress</span>
        <span className="text-xs text-muted-foreground ml-1">({cropData.length})</span>
        {attentionItems.length > 0 && (
          <Badge
            variant="secondary"
            className="text-[10px] h-5 px-2 rounded-full font-bold ml-1 bg-green-500/20 text-green-700 dark:text-green-400"
          >
            {attentionItems.length === 1
              ? `${attentionItems[0].plant.emoji} ${attentionItems[0].status.label}`
              : `${attentionItems.length} ready to harvest`}
          </Badge>
        )}
        <span className="ml-auto text-muted-foreground">
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </span>
      </button>

      {!collapsed && (
        <div className="px-4 py-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
            {cropData.map(c => (
              <div
                key={c.plantId}
                className={`rounded-2xl p-3 flex flex-col gap-2 border transition-shadow hover:shadow-md ${
                  c.status.needsAttention
                    ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                    : 'bg-card border-border'
                }`}
              >
                {/* Name + badge */}
                <div className="flex items-start justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xl shrink-0">{c.plant.emoji}</span>
                    <p className="text-xs font-bold text-foreground truncate leading-tight">
                      {c.plant.name}
                      {c.count > 1 && <span className="font-normal text-muted-foreground"> ×{c.count}</span>}
                    </p>
                  </div>
                </div>

                {/* Status badge */}
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit ${c.status.badgeClass}`}>
                  {c.status.label}
                </span>

                {/* Progress bar */}
                {!c.status.isEstablished && (
                  <Progress
                    value={c.progress}
                    className={`h-1.5 rounded-full ${c.status.progressClass}`}
                  />
                )}

                {/* Plain-English message */}
                <p className="text-[10px] text-muted-foreground leading-snug">
                  {c.status.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
