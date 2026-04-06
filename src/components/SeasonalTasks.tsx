import { useMemo } from 'react';
import { plants } from '@/data/plants';
import { getSuccessionTasks } from '@/utils/bedPlantSuggestions';
import { Sprout, Scissors, RefreshCw } from 'lucide-react';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthMatchesCurrent(rangeStr: string | undefined): boolean {
  if (!rangeStr) return false;
  const current = MONTH_NAMES[new Date().getMonth()];
  const parts = rangeStr.split(',').map(s => s.trim());
  for (const part of parts) {
    const [start, end] = part.split('-').map(s => s.trim());
    if (!end) {
      if (start === current) return true;
      continue;
    }
    const si = MONTH_NAMES.indexOf(start);
    const ei = MONTH_NAMES.indexOf(end);
    const ci = MONTH_NAMES.indexOf(current);
    if (si < 0 || ei < 0 || ci < 0) continue;
    if (si <= ei) {
      if (ci >= si && ci <= ei) return true;
    } else {
      if (ci >= si || ci <= ei) return true;
    }
  }
  return false;
}

interface SeasonalTasksProps {
  placedPlantIds?: string[];
}

export function SeasonalTasks({ placedPlantIds }: SeasonalTasksProps) {
  const currentMonth = MONTH_NAMES[new Date().getMonth()];

  const { toSow, toHarvest, successionAlerts } = useMemo(() => {
    const sow = plants.filter(p => monthMatchesCurrent(p.sowIndoors) || monthMatchesCurrent(p.sowOutdoors));
    const harvest = plants.filter(p => monthMatchesCurrent(p.harvest));

    // Succession alerts for placed plants being harvested this month
    const harvestingNow = (placedPlantIds || []).filter(id => {
      const p = plants.find(pl => pl.id === id);
      return p && monthMatchesCurrent(p.harvest);
    });
    const successionTasks = getSuccessionTasks([...new Set(harvestingNow)]);

    return {
      toSow: sow.slice(0, 3),
      toHarvest: harvest.slice(0, 3),
      successionAlerts: successionTasks.slice(0, 2),
    };
  }, [placedPlantIds]);

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 text-xs bg-secondary/50 border-b border-border overflow-x-auto">
      <span className="font-semibold text-foreground shrink-0">📅 {currentMonth}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        <Sprout className="h-3.5 w-3.5 text-primary" />
        <span className="text-muted-foreground">Sow:</span>
        {toSow.map(p => (
          <span key={p.id} className="inline-flex items-center gap-0.5 bg-primary/10 text-primary rounded px-1.5 py-0.5 font-medium">
            {p.emoji} {p.name}
          </span>
        ))}
        {toSow.length === 0 && <span className="text-muted-foreground italic">Nothing this month</span>}
      </div>
      <div className="h-4 w-px bg-border shrink-0" />
      <div className="flex items-center gap-1.5 shrink-0">
        <Scissors className="h-3.5 w-3.5 text-accent" />
        <span className="text-muted-foreground">Harvest:</span>
        {toHarvest.map(p => (
          <span key={p.id} className="inline-flex items-center gap-0.5 bg-accent/10 text-accent rounded px-1.5 py-0.5 font-medium">
            {p.emoji} {p.name}
          </span>
        ))}
        {toHarvest.length === 0 && <span className="text-muted-foreground italic">Nothing this month</span>}
      </div>
      {successionAlerts.length > 0 && (
        <>
          <div className="h-4 w-px bg-border shrink-0" />
          <div className="flex items-center gap-1.5 shrink-0">
            <RefreshCw className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground">Next:</span>
            {successionAlerts.map(alert => (
              <span key={alert.plantName} className="inline-flex items-center gap-0.5 bg-primary/10 text-primary rounded px-1.5 py-0.5 font-medium" title={`After ${alert.plantName} → ${alert.suggestions.map(s => s.plant.name).join(', ')}`}>
                {alert.plantEmoji} → {alert.suggestions[0]?.plant.emoji} {alert.suggestions[0]?.plant.name}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
