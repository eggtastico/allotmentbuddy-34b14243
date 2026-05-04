import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlacedPlant } from '@/types/garden';
import { getPlantById, rotationGroupColors, rotationGroupLabels } from '@/data/plants';
import { RefreshCw, AlertTriangle, Info } from 'lucide-react';

interface CropRotationPlannerProps {
  onClose: () => void;
  placedPlants: PlacedPlant[];
}

// The classic 4-year rotation cycle for the main groups.
// Plants "rotate" one step forward each year.
const ROTATION_CYCLE = ['legumes', 'brassicas', 'roots', 'solanaceae'] as const;

// Short display labels for the table
const SHORT_LABELS: Record<string, string> = {
  legumes: 'Legumes',
  brassicas: 'Brassicas',
  roots: 'Roots',
  solanaceae: 'Nightshades',
  alliums: 'Alliums',
  cucurbits: 'Cucurbits',
  leafy: 'Leafy greens',
  other: 'Other',
};

// Soil benefit notes for each group — shown in the rotation advice
const GROUP_BENEFITS: Record<string, string> = {
  legumes: 'Fixes nitrogen — improves soil for brassicas',
  brassicas: 'Follow legumes to use the nitrogen boost',
  roots: 'Loosen soil, follow brassicas',
  solanaceae: 'Heavy feeders — follow roots which left loose soil',
  alliums: 'Pest-deterrent; rotate with any group',
  cucurbits: 'Hungry feeders; add compost before planting',
  leafy: 'Light feeders; fill gaps in rotation',
  other: 'Perennials / herbs — stay in place',
};

function groupColor(group: string): string {
  return rotationGroupColors[group] ?? '#6b7280';
}

export function CropRotationPlanner({ onClose, placedPlants }: CropRotationPlannerProps) {
  const currentYear = new Date().getFullYear();

  // Analyse current garden — find which groups are present and how many plants
  const analysis = useMemo(() => {
    const groupPlants: Record<string, { count: number; names: string[] }> = {};
    for (const pp of placedPlants) {
      const plant = getPlantById(pp.plantId);
      if (!plant) continue;
      const g = plant.rotationGroup;
      if (!groupPlants[g]) groupPlants[g] = { count: 0, names: [] };
      groupPlants[g].count++;
      if (!groupPlants[g].names.includes(plant.name)) {
        groupPlants[g].names.push(plant.name);
      }
    }
    return groupPlants;
  }, [placedPlants]);

  // Build the 4-year rotation table for the classic cycle groups
  // For each zone (= current rotation group), project what goes there each year
  const cycleGroups = ROTATION_CYCLE.filter(g => analysis[g]);
  const nonCycleGroups = Object.keys(analysis).filter(
    g => !ROTATION_CYCLE.includes(g as typeof ROTATION_CYCLE[number]) && g !== 'other'
  );

  // The rotation table: rows = zones (named after current occupant), cols = years
  // zone[i] has group = ROTATION_CYCLE[(startIndex + year) % 4] in year `year`
  const rotationTable = cycleGroups.map((currentGroup) => {
    const startIndex = ROTATION_CYCLE.indexOf(currentGroup);
    const years = [0, 1, 2, 3].map(offset => ({
      year: currentYear + offset,
      group: ROTATION_CYCLE[(startIndex + offset) % ROTATION_CYCLE.length],
    }));
    return { zoneName: `Zone ${SHORT_LABELS[currentGroup]}`, years };
  });

  // Conflict check: are any two zones scheduled for the same group in the same year?
  const conflicts: string[] = [];
  for (let yearOffset = 0; yearOffset < 4; yearOffset++) {
    const groupsThisYear = rotationTable.map(row => row.years[yearOffset].group);
    const seen = new Set<string>();
    for (const g of groupsThisYear) {
      if (seen.has(g)) {
        conflicts.push(
          `${currentYear + yearOffset}: Multiple zones assigned to ${SHORT_LABELS[g]} — split your garden into more distinct zones`
        );
      }
      seen.add(g);
    }
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-4 w-4 text-primary" />
            4-Year Crop Rotation Planner
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="px-4 py-4 space-y-5">
            {placedPlants.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                Add plants to your garden to see rotation recommendations.
              </div>
            ) : (
              <>
                {/* Current garden summary */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    This Year ({currentYear}) — What's in your garden
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(analysis)
                      .filter(([g]) => g !== 'other')
                      .map(([group, { count, names }]) => (
                        <div
                          key={group}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium"
                          style={{
                            borderColor: groupColor(group) + '60',
                            background: groupColor(group) + '15',
                            color: groupColor(group),
                          }}
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: groupColor(group) }}
                          />
                          {SHORT_LABELS[group]} × {count}
                          <span className="font-normal text-[10px] opacity-70">
                            ({names.slice(0, 2).join(', ')}{names.length > 2 ? '…' : ''})
                          </span>
                        </div>
                      ))}
                    {analysis['other'] && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-border text-xs text-muted-foreground">
                        Perennials / herbs × {analysis['other'].count} (stay in place)
                      </div>
                    )}
                  </div>
                </div>

                {/* Rotation table — classic cycle groups */}
                {rotationTable.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      4-Year Rotation Schedule
                    </h3>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-28">Zone</th>
                            {[0, 1, 2, 3].map(offset => (
                              <th key={offset} className="text-center px-2 py-2 font-semibold">
                                {offset === 0 ? (
                                  <span className="text-primary">{currentYear} ✓</span>
                                ) : (
                                  <span className="text-muted-foreground">{currentYear + offset}</span>
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rotationTable.map((row, rowIdx) => (
                            <tr
                              key={rowIdx}
                              className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                            >
                              <td className="px-3 py-2.5 font-medium text-foreground">{row.zoneName}</td>
                              {row.years.map(({ year, group }, yearIdx) => {
                                const isNow = yearIdx === 0;
                                const color = groupColor(group);
                                return (
                                  <td key={year} className="px-2 py-2.5 text-center">
                                    <div
                                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold ${isNow ? 'ring-1 ring-primary/40' : ''}`}
                                      style={{
                                        background: color + (isNow ? '25' : '15'),
                                        color,
                                      }}
                                    >
                                      <span
                                        className="w-1.5 h-1.5 rounded-full shrink-0"
                                        style={{ background: color }}
                                      />
                                      {SHORT_LABELS[group]}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5 italic">
                      Each zone rotates one group forward per year. Divide your plot into these zones for best results.
                    </p>
                  </div>
                )}

                {/* Non-cycle groups advice */}
                {nonCycleGroups.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Other Groups in Your Garden
                    </h3>
                    <div className="space-y-2">
                      {nonCycleGroups.map(group => (
                        <div
                          key={group}
                          className="flex items-start gap-2.5 p-2.5 rounded-lg border"
                          style={{ borderColor: groupColor(group) + '40', background: groupColor(group) + '0A' }}
                        >
                          <span
                            className="w-3 h-3 rounded-full mt-0.5 shrink-0"
                            style={{ background: groupColor(group) }}
                          />
                          <div>
                            <span className="font-semibold text-xs" style={{ color: groupColor(group) }}>
                              {SHORT_LABELS[group]}
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-1.5">
                              {analysis[group].names.slice(0, 3).join(', ')}
                            </span>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{GROUP_BENEFITS[group]}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conflicts */}
                {conflicts.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Rotation Conflicts
                    </h3>
                    {conflicts.map((c, i) => (
                      <div key={i} className="flex gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        {c}
                      </div>
                    ))}
                  </div>
                )}

                {/* Group benefits legend */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5" /> Why rotate?
                  </h3>
                  <div className="space-y-1.5">
                    {ROTATION_CYCLE.map((group, i) => (
                      <div key={group} className="flex items-start gap-2 text-xs">
                        <span className="text-muted-foreground font-mono w-4 shrink-0 mt-0.5">Y{i + 1}</span>
                        <span
                          className="font-semibold shrink-0"
                          style={{ color: groupColor(group) }}
                        >
                          {SHORT_LABELS[group]}
                        </span>
                        <span className="text-muted-foreground">{GROUP_BENEFITS[group]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
