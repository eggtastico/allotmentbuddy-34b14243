import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { plants as plantDB } from '@/data/plants';
import { PlacedPlant } from '@/types/garden';
import { Plus, Trash2, Loader2, ListTodo, Leaf, Sprout, Scissors } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { toast } from 'sonner';
import { PLANT_FEEDING, NO_FEED, FeedingInfo } from '@/utils/feedingGuide';
import { getSuccessionSuggestions } from '@/utils/successionPlanting';
import { generateWeeklyFeedingSchedule, generateMonthlyFeedingSchedule, GeneratedTask } from '@/utils/gardenTaskGeneration';
import { getSuccessionTasks } from '@/utils/bedPlantSuggestions';

// ── Local storage for unauthenticated tasks ──────────────────────────────────
const LOCAL_TASKS_KEY = 'allotment-custom-tasks-v2';

interface CustomTask {
  id: string;
  title: string;
  description: string;
  due_date: string | null;
  completed: boolean;
}

function loadLocalTasks(): CustomTask[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_TASKS_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(task =>
      task && typeof task === 'object' &&
      'id' in task && 'title' in task && 'description' in task
    ) as CustomTask[];
  } catch (err) {
    console.warn('Failed to load local tasks:', err);
    return [];
  }
}

function saveLocalTasks(tasks: CustomTask[]) {
  localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(tasks));
}

// ── Props ────────────────────────────────────────────────────────────────────
interface GardenTasksProps {
  onClose: () => void;
  placedPlants: PlacedPlant[];
  inline?: boolean;
  frostDates?: { lastSpringFrost?: string; firstFallFrost?: string } | null;
}

// ── Month helper ─────────────────────────────────────────────────────────────
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

// ── Component ────────────────────────────────────────────────────────────────
export function GardenTasks({ onClose, placedPlants, inline = false, frostDates }: GardenTasksProps) {
  const { user } = useAuth();
  const [customTasks, setCustomTasks] = useState<CustomTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [tab, setTab] = useState(inline ? 'today' : 'tasks');
  const [weeklyFeeding, setWeeklyFeeding] = useState<GeneratedTask[]>([]);
  const [monthlyFeeding, setMonthlyFeeding] = useState<GeneratedTask[]>([]);

  // Load custom tasks (Supabase when logged in, localStorage otherwise)
  useEffect(() => {
    const load = async () => {
      if (user) {
        const { data, error } = await supabase
          .from('garden_tasks')
          .select('*')
          .eq('user_id', user.id)
          .neq('period', 'daily')
          .order('created_at', { ascending: false });
        if (error) {
          console.error('Failed to load garden tasks:', error);
        } else if (data && Array.isArray(data)) {
          const validated = data.filter(task =>
            task && 'id' in task && 'title' in task && 'description' in task
          ) as CustomTask[];
          setCustomTasks(validated);
        }
      } else {
        setCustomTasks(loadLocalTasks());
      }
      setLoading(false);
    };
    load();
  }, [user]);

  // Load weekly/monthly feeding schedules (inline mode only)
  useEffect(() => {
    if (!inline || placedPlants.length === 0) return;
    setWeeklyFeeding(generateWeeklyFeedingSchedule(placedPlants));
    setMonthlyFeeding(generateMonthlyFeedingSchedule(placedPlants));
  }, [inline, placedPlants]);

  // Week/month task data (inline mode only)
  const taskData = useMemo(() => {
    if (!inline) return null;
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

    const soonThisWeek = harvestStatus.filter(h => h.daysRemaining > 0 && h.daysRemaining <= 7 && !h.isEstablished);

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
    const plantedIds = new Set(placedPlants.map(p => p.plantId));
    const toSow = plantDB.filter(p => monthMatchesCurrent(p.sowIndoors) || monthMatchesCurrent(p.sowOutdoors));
    const toHarvest = plantDB.filter(p => monthMatchesCurrent(p.harvest) && plantedIds.has(p.id));

    return { soonThisWeek, successionAlerts, toSow, toHarvest };
  }, [inline, placedPlants]);

  // Auto-generated tasks from placed plants
  const generatedTasks = useMemo(() => {
    const now = new Date();
    const tasks: Array<{
      id: string;
      icon: string;
      title: string;
      description: string;
      priority: 'high' | 'medium' | 'low';
    }> = [];

    if (placedPlants.length === 0) return tasks;

    // Watering
    tasks.push({
      id: 'water-all',
      icon: '💧',
      title: 'Water your plants',
      description: `${placedPlants.length} plant${placedPlants.length !== 1 ? 's' : ''} in your garden. Check soil moisture before watering — stick a finger 2cm deep.`,
      priority: 'high',
    });

    // Harvest checks (within 7 days of harvest date)
    for (const pp of placedPlants) {
      const plant = plantDB.find(p => p.id === pp.plantId);
      if (!plant?.daysToHarvest) continue;
      const daysElapsed = Math.floor((now.getTime() - new Date(pp.plantedAt).getTime()) / 86400000);
      const daysRemaining = plant.daysToHarvest - daysElapsed;
      if (daysRemaining >= 0 && daysRemaining <= 7) {
        tasks.push({
          id: `harvest-${pp.id}`,
          icon: '🌾',
          title: `Check ${plant.name} for harvest`,
          description: daysRemaining === 0
            ? `${plant.emoji} Ready to harvest today!`
            : `${plant.emoji} About ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} until ready — check daily.`,
          priority: daysRemaining <= 2 ? 'high' : 'medium',
        });
      }
    }

    // Feeding reminders (de-duplicated by plant type, only after 3+ weeks or established)
    const seenPlantIds = new Set<string>();
    for (const pp of placedPlants) {
      if (seenPlantIds.has(pp.plantId)) continue;
      if (NO_FEED.has(pp.plantId)) continue;
      const feedInfo = PLANT_FEEDING[pp.plantId];
      if (!feedInfo) continue;
      const plant = plantDB.find(p => p.id === pp.plantId);
      if (!plant) continue;
      const daysElapsed = Math.floor((now.getTime() - new Date(pp.plantedAt).getTime()) / 86400000);
      if (daysElapsed >= 21 || pp.stage === 'established') {
        seenPlantIds.add(pp.plantId);
        tasks.push({
          id: `feed-${pp.plantId}`,
          icon: '🌿',
          title: `Feed ${plant.name}`,
          description: `${feedInfo.feedType}. ${feedInfo.when}. ${feedInfo.frequency}.`,
          priority: 'medium',
        });
      }
    }

    // Succession planting suggestions — for plants approaching harvest, suggest what to sow next
    const seenSuccession = new Set<string>();
    for (const pp of placedPlants) {
      if (seenSuccession.has(pp.plantId)) continue;
      const plant = plantDB.find(p => p.id === pp.plantId);
      if (!plant?.daysToHarvest) continue;
      const daysElapsed = Math.floor((now.getTime() - new Date(pp.plantedAt).getTime()) / 86400000);
      // Suggest succession when within 3 weeks of harvest or already past
      if (daysElapsed >= plant.daysToHarvest - 21) {
        seenSuccession.add(pp.plantId);
        const nowMonth = now.getMonth();
        const suggestions = getSuccessionSuggestions(pp.plantId, nowMonth).slice(0, 3);
        if (suggestions.length > 0) {
          const names = suggestions.map(s => `${s.plant.emoji} ${s.plant.name}`).join(', ');
          tasks.push({
            id: `succession-${pp.plantId}`,
            icon: '🔄',
            title: `Succession sow after ${plant.name}`,
            description: `${plant.emoji} ${plant.name} is nearing harvest — consider sowing: ${names}.`,
            priority: 'low',
          });
        }
      }
    }

    // Weed check
    tasks.push({
      id: 'weed-check',
      icon: '🌱',
      title: 'Check for weeds',
      description: 'Remove weeds before they set seed. Hoe on a dry day for best results.',
      priority: 'low',
    });

    return tasks.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    });
  }, [placedPlants]);

  // Feeding guide — one entry per unique plant type in the garden
  const feedingGuide = useMemo(() => {
    const seen = new Set<string>();
    const guide: Array<{
      plantId: string;
      name: string;
      emoji: string;
      feedInfo: FeedingInfo | null;
      noFeed: boolean;
    }> = [];
    for (const pp of placedPlants) {
      if (seen.has(pp.plantId)) continue;
      seen.add(pp.plantId);
      const plant = plantDB.find(p => p.id === pp.plantId);
      if (!plant) continue;
      guide.push({
        plantId: pp.plantId,
        name: plant.name,
        emoji: plant.emoji,
        feedInfo: PLANT_FEEDING[pp.plantId] ?? null,
        noFeed: NO_FEED.has(pp.plantId),
      });
    }
    return guide;
  }, [placedPlants]);

  const addTask = async () => {
    if (!newTitle.trim()) return;
    if (user) {
      const { data, error } = await supabase
        .from('garden_tasks')
        .insert({
          user_id: user.id,
          title: newTitle.trim(),
          description: newDesc.trim(),
          period: 'custom',
          due_date: newDueDate || null,
          completed: false,
        })
        .select('*')
        .single();
      if (error || !data) { toast.error('Failed to add task'); return; }
      setCustomTasks(prev => [data as CustomTask, ...prev]);
    } else {
      const task: CustomTask = {
        id: `local-${Date.now()}`,
        title: newTitle.trim(),
        description: newDesc.trim(),
        due_date: newDueDate || null,
        completed: false,
      };
      const updated = [task, ...customTasks];
      setCustomTasks(updated);
      saveLocalTasks(updated);
    }
    setNewTitle(''); setNewDesc(''); setNewDueDate(''); setAdding(false);
    toast.success('Task added');
  };

  const toggleComplete = async (task: CustomTask) => {
    const next = !task.completed;
    const updated = customTasks.map(t => t.id === task.id ? { ...t, completed: next } : t);
    setCustomTasks(updated);
    if (user) {
      await supabase.from('garden_tasks').update({ completed: next }).eq('id', task.id);
    } else {
      saveLocalTasks(updated);
    }
  };

  const deleteTask = async (id: string) => {
    const updated = customTasks.filter(t => t.id !== id);
    setCustomTasks(updated);
    if (user) {
      await supabase.from('garden_tasks').delete().eq('id', id);
    } else {
      saveLocalTasks(updated);
    }
    toast.success('Task removed');
  };

  const incomplete = customTasks.filter(t => !t.completed);
  const completed = customTasks.filter(t => t.completed);

  const currentMonth = MONTH_NAMES[new Date().getMonth()];

  // ── Shared tab content pieces ──────────────────────────────────────────────

  const todayTabContent = (
    <TabsContent value={inline ? 'today' : 'tasks'} className="space-y-1.5 mt-2">
      {placedPlants.length === 0 ? (
        <div className="text-center py-6">
          <Sprout className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-xs font-medium text-foreground mb-1">No plants placed yet</p>
          <p className="text-[11px] text-muted-foreground">Add plants to your garden to get task reminders.</p>
        </div>
      ) : (
        generatedTasks.map(task => (
          <div
            key={task.id}
            className={`p-2 rounded border-l-3 ${
              task.priority === 'high'
                ? 'bg-red-50 dark:bg-red-950/20 border-red-400'
                : task.priority === 'medium'
                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-400'
                : 'bg-blue-50 dark:bg-blue-950/20 border-blue-400'
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="text-base shrink-0">{task.icon}</span>
              <div>
                <p className="text-xs font-semibold text-foreground">{task.title}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">{task.description}</p>
              </div>
            </div>
          </div>
        ))
      )}
    </TabsContent>
  );

  const feedingTabContent = (
    <TabsContent value="feeding" className="space-y-1.5 mt-2">
      {feedingGuide.length === 0 ? (
        <div className="text-center py-6">
          <Leaf className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-xs font-medium text-foreground mb-1">No plants in your garden</p>
          <p className="text-[11px] text-muted-foreground">Add plants to see their feeding requirements.</p>
        </div>
      ) : (
        <>
          {feedingGuide.map(({ plantId, name, emoji, feedInfo, noFeed }) => (
            <div key={plantId} className="p-2 rounded border border-border bg-card space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-base">{emoji}</span>
                <span className="font-semibold text-xs text-foreground">{name}</span>
                {noFeed && (
                  <Badge variant="outline" className="text-[9px] text-green-700 border-green-300 bg-green-50 dark:bg-green-950/30 h-4 px-1">
                    No feed
                  </Badge>
                )}
              </div>
              {noFeed ? (
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Legumes fix nitrogen — no fertiliser required.
                </p>
              ) : feedInfo ? (
                <div className="text-[11px] leading-tight text-muted-foreground">
                  <span className="text-foreground">{feedInfo.feedType}</span> · {feedInfo.frequency}
                  {feedInfo.products && <span className="text-primary/80"> · {feedInfo.products}</span>}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground leading-tight">
                  General balanced fertiliser in spring.
                </p>
              )}
            </div>
          ))}
        </>
      )}
    </TabsContent>
  );

  const myTasksTabContent = (
    <TabsContent value="my-tasks" className="space-y-3 mt-3">
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {incomplete.length === 0 && completed.length === 0 && !adding && (
            <EmptyState
              icon={ListTodo}
              title="No custom tasks yet"
              description="Add your own gardening reminders — watering schedules, planting dates, or anything else."
              actionLabel="Add a task"
              onAction={() => setAdding(true)}
            />
          )}

          {/* Incomplete */}
          <div className="space-y-2">
            {incomplete.map(task => (
              <TaskItem key={task.id} task={task} onToggle={toggleComplete} onDelete={deleteTask} />
            ))}
          </div>

          {/* Completed */}
          {completed.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide mb-1.5 mt-2">Done</p>
              <div className="space-y-2">
                {completed.map(task => (
                  <TaskItem key={task.id} task={task} onToggle={toggleComplete} onDelete={deleteTask} />
                ))}
              </div>
            </div>
          )}

          {/* Add task form */}
          {adding ? (
            <div className="space-y-2 p-3 border border-border rounded-lg bg-muted/30">
              <Input
                placeholder="Task title"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTask()}
                className="text-sm"
                autoFocus
              />
              <Textarea
                placeholder="Notes (optional)"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                className="text-sm min-h-[50px]"
              />
              <Input
                type="date"
                value={newDueDate}
                onChange={e => setNewDueDate(e.target.value)}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={addTask} disabled={!newTitle.trim()}>Add</Button>
                <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewTitle(''); setNewDesc(''); setNewDueDate(''); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="w-full" onClick={() => setAdding(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add custom task
            </Button>
          )}

          {!user && (
            <p className="text-[10px] text-muted-foreground text-center pt-1">
              Tasks saved on this device. Sign in to sync across devices.
            </p>
          )}
        </>
      )}
    </TabsContent>
  );

  // ── Inline (mobile) tab layout: Today | This Week | This Month | Feeding | My Tasks ──
  const inlineTabsContent = (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="w-full overflow-x-auto overflow-y-hidden flex-nowrap">
        <TabsTrigger value="today" className="flex-1 text-xs whitespace-nowrap">
          Today
          {generatedTasks.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5 bg-primary/20 text-primary">{generatedTasks.length}</Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="week" className="flex-1 text-xs whitespace-nowrap">
          Week
          {taskData && taskData.soonThisWeek.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5 bg-amber-500/20 text-amber-700">{taskData.soonThisWeek.length}</Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="month" className="flex-1 text-xs whitespace-nowrap">
          Month
        </TabsTrigger>
        <TabsTrigger value="feeding" className="flex-1 text-xs whitespace-nowrap">
          Feeding
        </TabsTrigger>
        <TabsTrigger value="my-tasks" className="flex-1 text-xs whitespace-nowrap">
          My Tasks
          {incomplete.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">{incomplete.length}</Badge>
          )}
        </TabsTrigger>
      </TabsList>

      {/* ── Today ── */}
      {todayTabContent}

      {/* ── This Week ── */}
      <TabsContent value="week" className="space-y-2 mt-2">
        {taskData && taskData.soonThisWeek.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Scissors className="h-3.5 w-3.5 text-amber-600" />
              Harvest Soon
            </div>
            <div className="grid gap-1.5">
              {taskData.soonThisWeek.map(h => (
                <div key={h.plantId} className="p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{h.plant.emoji}</span>
                      <span className="font-medium text-xs">{h.plant.name}</span>
                      {h.count > 1 && <span className="text-[10px] text-muted-foreground">x{h.count}</span>}
                    </div>
                    <Badge className="bg-amber-500 text-white text-[10px] h-4 px-1.5">{h.daysRemaining}d</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {weeklyFeeding.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Sprout className="h-3.5 w-3.5 text-green-600" />
              Feeding This Week
            </div>
            <div className="grid gap-1.5">
              {weeklyFeeding.map(task => (
                <div key={task.id} className="p-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded">
                  <p className="font-medium text-xs text-foreground">{task.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">{task.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {taskData && taskData.successionAlerts.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Sprout className="h-3.5 w-3.5 text-primary" />
              Plant Next
            </div>
            <div className="grid gap-1.5">
              {taskData.successionAlerts.map(alert => (
                <div key={alert.plantName} className="p-2 bg-primary/10 border border-primary/20 rounded">
                  <p className="text-[11px] text-muted-foreground">
                    After <strong>{alert.plantName}</strong> → <strong>{alert.suggestions.map(s => s.plant.name).join(', ')}</strong>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {(!taskData || (taskData.soonThisWeek.length === 0 && weeklyFeeding.length === 0 && taskData.successionAlerts.length === 0)) && (
          <div className="p-2 bg-muted rounded text-center">
            <p className="text-[11px] text-muted-foreground">No urgent actions this week.</p>
          </div>
        )}
      </TabsContent>

      {/* ── This Month ── */}
      <TabsContent value="month" className="space-y-2 mt-2">
        {monthlyFeeding.length > 0 && (
          <div className="p-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded">
            <p className="text-[11px] text-muted-foreground">
              <strong>Feeding:</strong> {monthlyFeeding.length} plant{monthlyFeeding.length !== 1 ? 's' : ''} need feeding this month
            </p>
          </div>
        )}

        {taskData && taskData.toSow.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Sprout className="h-3.5 w-3.5 text-primary" />
              Sow in {currentMonth}
            </div>
            <div className="flex flex-wrap gap-1">
              {taskData.toSow.slice(0, 8).map(p => (
                <Badge key={p.id} className="bg-primary/20 text-primary font-normal text-[10px] h-5 px-1.5">
                  {p.emoji} {p.name}
                </Badge>
              ))}
              {taskData.toSow.length > 8 && <Badge variant="outline" className="text-[10px] h-5 px-1.5">{taskData.toSow.length - 8}+ more</Badge>}
            </div>
          </div>
        )}

        {taskData && taskData.toHarvest.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Scissors className="h-3.5 w-3.5 text-accent" />
              Harvest in {currentMonth}
            </div>
            <div className="flex flex-wrap gap-1">
              {taskData.toHarvest.slice(0, 8).map(p => (
                <Badge key={p.id} className="bg-accent/20 text-accent font-normal text-[10px] h-5 px-1.5">
                  {p.emoji} {p.name}
                </Badge>
              ))}
              {taskData.toHarvest.length > 8 && <Badge variant="outline" className="text-[10px] h-5 px-1.5">{taskData.toHarvest.length - 8}+ more</Badge>}
            </div>
          </div>
        )}

        {monthlyFeeding.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Sprout className="h-3.5 w-3.5 text-green-600" />
              Feeding This Month
            </div>
            <div className="grid gap-1.5">
              {monthlyFeeding.map(task => (
                <div key={task.id} className="p-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded">
                  <p className="font-medium text-xs text-foreground">{task.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">{task.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {frostDates && (
          <div className="p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded text-[11px] text-muted-foreground">
            <p><strong>Frost:</strong> Last spring {frostDates.lastSpringFrost}, first fall {frostDates.firstFallFrost}</p>
          </div>
        )}

        {(!taskData || (taskData.toSow.length === 0 && taskData.toHarvest.length === 0 && monthlyFeeding.length === 0)) && (
          <div className="p-2 bg-muted rounded text-center">
            <p className="text-[11px] text-muted-foreground">Quiet month for sowing and harvesting.</p>
          </div>
        )}
      </TabsContent>

      {/* ── Feeding Guide ── */}
      {feedingTabContent}

      {/* ── My Tasks ── */}
      {myTasksTabContent}
    </Tabs>
  );

  // ── Dialog (non-inline) tab layout: Tasks | Feeding Guide | My Tasks ──
  const dialogTabsContent = (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="w-full">
        <TabsTrigger value="tasks" className="flex-1 text-xs">
          Tasks
          {generatedTasks.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5 bg-primary/20 text-primary">{generatedTasks.length}</Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="feeding" className="flex-1 text-xs">
          Feeding Guide
        </TabsTrigger>
        <TabsTrigger value="my-tasks" className="flex-1 text-xs">
          My Tasks
          {incomplete.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">{incomplete.length}</Badge>
          )}
        </TabsTrigger>
      </TabsList>

      {/* ── Auto-generated Tasks ── */}
      {todayTabContent}

      {/* ── Feeding Guide ── */}
      {feedingTabContent}

      {/* ── My Tasks ── */}
      {myTasksTabContent}
    </Tabs>
  );

  const tabsContent = inline ? inlineTabsContent : dialogTabsContent;

  if (inline) {
    return (
      <div className="px-3 pt-2 pb-1">
        {tabsContent}
      </div>
    );
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" /> Garden Tasks
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0">
          {tabsContent}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TaskItem({
  task,
  onToggle,
  onDelete,
}: {
  task: CustomTask;
  onToggle: (t: CustomTask) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={`flex items-start gap-2 p-2.5 rounded-lg border border-border ${task.completed ? 'opacity-50 bg-muted/30' : 'bg-card'}`}>
      <Checkbox
        checked={task.completed}
        onCheckedChange={() => onToggle(task)}
        className="mt-0.5 flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
        )}
        {task.due_date && (
          <Badge variant="outline" className="text-[10px] mt-1">
            {new Date(task.due_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </Badge>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={() => onDelete(task.id)}
      >
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </div>
  );
}
