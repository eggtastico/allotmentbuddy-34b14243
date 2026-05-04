import { useMemo, useState } from 'react';
import { PlacedPlant } from '@/types/garden';
import { plants as plantDB } from '@/data/plants';
import { getSuccessionTasks } from '@/utils/bedPlantSuggestions';
import { ChevronDown, ChevronUp, Droplets, Sprout, Scissors, Lightbulb } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

interface GardenAssistantPanelProps {
  placedPlants: PlacedPlant[];
  frostDates?: { lastSpringFrost?: string; firstFallFrost?: string } | null;
}

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

export function GardenAssistantPanel({ placedPlants, frostDates }: GardenAssistantPanelProps) {
  const [collapsed, setCollapsed] = useState(true);
  const today = new Date();
  const currentMonth = MONTH_NAMES[today.getMonth()];
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = `${dayName}, ${today.getDate()} ${currentMonth} ${today.getFullYear()}`;

  const taskData = useMemo(() => {
    const now = new Date();

    // Group plants by ID, keeping earliest plant date
    const plantGroups = new Map<string, { plantId: string; plantedAt: Date; count: number; isEstablished: boolean }>();
    for (const pp of placedPlants) {
      const existing = plantGroups.get(pp.plantId);
      const d = new Date(pp.plantedAt);
      const established = pp.stage === 'established';
      if (!existing || d < existing.plantedAt) {
        plantGroups.set(pp.plantId, {
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

    // Compute harvest timing for each plant
    const harvestStatus = Array.from(plantGroups.values()).map(g => {
      const plant = plantDB.find(p => p.id === g.plantId);
      if (!plant) return null;
      const daysElapsed = Math.floor((now.getTime() - g.plantedAt.getTime()) / 86400000);
      const daysToHarvest = plant.daysToHarvest ?? 90;
      const daysRemaining = Math.max(0, daysToHarvest - daysElapsed);
      return { ...g, plant, daysElapsed, daysToHarvest, daysRemaining };
    }).filter((x): x is Exclude<typeof x, null> => x !== null);

    // Categorize by timing
    const readyNow = harvestStatus.filter(h => h.daysElapsed >= h.daysToHarvest && !h.isEstablished);
    const soonThisWeek = harvestStatus.filter(h => h.daysRemaining > 0 && h.daysRemaining <= 7 && !h.isEstablished);
    const justPlanted = harvestStatus.filter(h => h.daysElapsed < 14 && !h.isEstablished);
    const growing = harvestStatus.filter(h => h.daysRemaining > 7 && h.daysElapsed >= 14 && !h.isEstablished);

    // Get succession alerts for plants being harvested
    const harvestingNow = placedPlants
      .filter(pp => plantDB.find(p => p.id === pp.plantId)?.daysToHarvest)
      .filter(pp => {
        const h = harvestStatus.find(x => x.plantId === pp.plantId);
        return h && (h.daysElapsed >= h.daysToHarvest);
      })
      .map(pp => pp.plantId);
    const successionAlerts = getSuccessionTasks([...new Set(harvestingNow)]);

    // Month tasks
    const toSow = plantDB.filter(p => monthMatchesCurrent(p.sowIndoors) || monthMatchesCurrent(p.sowOutdoors));
    const toHarvest = plantDB.filter(p => monthMatchesCurrent(p.harvest));

    // Plant tips (from what's actually in the garden)
    const plantedIds = new Set(placedPlants.map(p => p.plantId));
    const placedPlantData = Array.from(plantedIds)
      .map(id => plantDB.find(p => p.id === id))
      .filter((p): p is typeof plantDB[0] => p !== undefined);

    return {
      readyNow,
      soonThisWeek,
      justPlanted,
      growing,
      successionAlerts,
      toSow,
      toHarvest,
      placedPlantData,
      totalPlanted: placedPlants.length,
    };
  }, [placedPlants]);

  return (
    <div className="border-b border-border">
      {/* Header - always visible */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-4 py-3 flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors"
      >
        <span className="text-sm font-semibold">📅 {dateStr}</span>

        {/* Quick summary badges */}
        {taskData.readyNow.length > 0 && (
          <Badge className="bg-green-500 text-white hover:bg-green-600">
            🔴 {taskData.readyNow.length} harvest now
          </Badge>
        )}
        {taskData.toSow.length > 0 && (
          <Badge className="bg-blue-400 text-white hover:bg-blue-500">
            🌱 {taskData.toSow.length} to sow
          </Badge>
        )}
        {taskData.readyNow.length === 0 && taskData.toSow.length === 0 && taskData.totalPlanted > 0 && (
          <span className="text-xs text-blue-100">All on track</span>
        )}

        <span className="ml-auto">
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </span>
      </button>

      {/* Collapsible body */}
      {!collapsed && (
        <div className="bg-card">
          <Tabs defaultValue="today" className="w-full">
            <TabsList className="w-full border-b border-border rounded-none justify-start bg-transparent p-0">
              <TabsTrigger value="today" className="rounded-none border-b-2 border-b-transparent data-[state=active]:border-b-blue-600">
                Today
                {(taskData.readyNow.length + taskData.justPlanted.length) > 0 && (
                  <Badge className="ml-1.5 bg-red-500/20 text-red-700 dark:text-red-400">
                    {taskData.readyNow.length + taskData.justPlanted.length}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger value="week" className="rounded-none border-b-2 border-b-transparent data-[state=active]:border-b-blue-600">
                This Week
                {taskData.soonThisWeek.length > 0 && (
                  <Badge className="ml-1.5 bg-amber-500/20 text-amber-700 dark:text-amber-400">
                    {taskData.soonThisWeek.length}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger value="month" className="rounded-none border-b-2 border-b-transparent data-[state=active]:border-b-blue-600">
                This Month
              </TabsTrigger>

              <TabsTrigger value="tips" className="rounded-none border-b-2 border-b-transparent data-[state=active]:border-b-blue-600">
                Monthly Tips
              </TabsTrigger>
            </TabsList>

            {/* TODAY */}
            <TabsContent value="today" className="p-4 space-y-4">
              {taskData.readyNow.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Scissors className="h-4 w-4 text-green-600" />
                    Ready to Harvest Now
                  </div>
                  <div className="grid gap-2">
                    {taskData.readyNow.map(h => (
                      <div key={h.plantId} className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl">{h.plant.emoji}</span>
                          <span className="font-medium text-sm">{h.plant.name}</span>
                          {h.count > 1 && <span className="text-xs text-muted-foreground">×{h.count}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground">{h.plant.tips?.split('.')[0] || 'Ready to harvest — don\'t wait too long!'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {taskData.justPlanted.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Sprout className="h-4 w-4 text-blue-600" />
                    Just Planted
                  </div>
                  <div className="grid gap-2">
                    {taskData.justPlanted.map(h => (
                      <div key={h.plantId} className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl">{h.plant.emoji}</span>
                          <span className="font-medium text-sm">{h.plant.name}</span>
                          {h.count > 1 && <span className="text-xs text-muted-foreground">×{h.count}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground">Keep soil moist, protect from slugs and birds.</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {taskData.totalPlanted > 0 && (
                <div className="p-3 bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800 rounded-lg flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-cyan-600 flex-shrink-0" />
                  <span className="text-xs text-muted-foreground"><strong>Water regularly</strong> — check soil moisture before watering.</span>
                </div>
              )}

              {taskData.readyNow.length === 0 && taskData.justPlanted.length === 0 && taskData.totalPlanted > 0 && (
                <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-xs text-muted-foreground">✨ Everything looking good! No urgent tasks today.</p>
                </div>
              )}

              {taskData.totalPlanted === 0 && (
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">No plants planted yet. Add some plants to get started!</p>
                </div>
              )}
            </TabsContent>

            {/* THIS WEEK */}
            <TabsContent value="week" className="p-4 space-y-4">
              {taskData.soonThisWeek.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Scissors className="h-4 w-4 text-amber-600" />
                    Harvest Soon
                  </div>
                  <div className="grid gap-2">
                    {taskData.soonThisWeek.map(h => (
                      <div key={h.plantId} className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{h.plant.emoji}</span>
                            <span className="font-medium text-sm">{h.plant.name}</span>
                            {h.count > 1 && <span className="text-xs text-muted-foreground">×{h.count}</span>}
                          </div>
                          <Badge className="bg-amber-500 text-white">{h.daysRemaining}d</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">Check daily — harvest when it looks right.</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {taskData.successionAlerts.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Sprout className="h-4 w-4 text-primary" />
                    What to Plant Next
                  </div>
                  <div className="grid gap-2">
                    {taskData.successionAlerts.map(alert => (
                      <div key={alert.plantName} className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                        <p className="text-xs text-muted-foreground">
                          After <strong>{alert.plantName}</strong> → try{' '}
                          <strong>{alert.suggestions.map(s => s.plant.name).join(', ')}</strong>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {taskData.soonThisWeek.length === 0 && taskData.successionAlerts.length === 0 && (
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">No urgent actions this week. Good timing!</p>
                </div>
              )}
            </TabsContent>

            {/* THIS MONTH */}
            <TabsContent value="month" className="p-4 space-y-4">
              {(taskData.toSow.length > 0 || taskData.toHarvest.length > 0) && (
                <>
                  {taskData.toSow.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Sprout className="h-4 w-4 text-primary" />
                        Sow in {currentMonth}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {taskData.toSow.slice(0, 8).map(p => (
                          <Badge key={p.id} className="bg-primary/20 text-primary font-normal">
                            {p.emoji} {p.name}
                          </Badge>
                        ))}
                        {taskData.toSow.length > 8 && <Badge variant="outline">{taskData.toSow.length - 8}+ more</Badge>}
                      </div>
                    </div>
                  )}

                  {taskData.toHarvest.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Scissors className="h-4 w-4 text-accent" />
                        Harvest in {currentMonth}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {taskData.toHarvest.slice(0, 8).map(p => (
                          <Badge key={p.id} className="bg-accent/20 text-accent font-normal">
                            {p.emoji} {p.name}
                          </Badge>
                        ))}
                        {taskData.toHarvest.length > 8 && <Badge variant="outline">{taskData.toHarvest.length - 8}+ more</Badge>}
                      </div>
                    </div>
                  )}

                  {frostDates && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-muted-foreground">
                      <p><strong>Frost dates:</strong> Last spring {frostDates.lastSpringFrost}, first fall {frostDates.firstFallFrost}</p>
                    </div>
                  )}
                </>
              )}

              {taskData.toSow.length === 0 && taskData.toHarvest.length === 0 && (
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Quiet month for sowing and harvesting.</p>
                </div>
              )}
            </TabsContent>

            {/* MONTHLY TIPS */}
            <TabsContent value="tips" className="p-4 space-y-4">
              {taskData.placedPlantData.length > 0 ? (
                <div className="space-y-3">
                  {taskData.placedPlantData.slice(0, 4).map(p => {
                    const tip = p.tips?.split('.')[0] + '.';
                    return (
                      <div key={p.id} className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex items-start gap-2 mb-1">
                          <span className="text-lg">{p.emoji}</span>
                          <span className="font-medium text-sm flex-1">{p.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6">{tip || 'No tips available.'}</p>
                      </div>
                    );
                  })}
                  {taskData.placedPlantData.length > 4 && (
                    <p className="text-xs text-muted-foreground text-center">And {taskData.placedPlantData.length - 4} more plants in your garden.</p>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-muted rounded-lg text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-yellow-600" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <strong>Seasonal Tip:</strong> This is a great time to plan your garden for next season. Consider crop rotation and frost dates for your area.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
