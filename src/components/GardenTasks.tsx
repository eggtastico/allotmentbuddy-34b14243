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
import { Plus, Trash2, Loader2, ListTodo, Leaf, Sprout } from 'lucide-react';
import { toast } from 'sonner';
import { PLANT_FEEDING, NO_FEED, FeedingInfo } from '@/utils/feedingGuide';
import { getSuccessionSuggestions } from '@/utils/successionPlanting';

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
}

// ── Component ────────────────────────────────────────────────────────────────
export function GardenTasks({ onClose, placedPlants }: GardenTasksProps) {
  const { user } = useAuth();
  const [customTasks, setCustomTasks] = useState<CustomTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [tab, setTab] = useState('tasks');

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

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" /> Garden Tasks
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
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
            <TabsContent value="tasks" className="space-y-2 mt-3">
              {placedPlants.length === 0 ? (
                <div className="text-center py-10">
                  <Sprout className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <p className="text-sm font-medium text-foreground mb-1">No plants placed yet</p>
                  <p className="text-xs text-muted-foreground">Add plants to your garden to get task reminders.</p>
                </div>
              ) : (
                generatedTasks.map(task => (
                  <div
                    key={task.id}
                    className={`p-3 rounded-lg border-l-4 ${
                      task.priority === 'high'
                        ? 'bg-red-50 dark:bg-red-950/20 border-red-400'
                        : task.priority === 'medium'
                        ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-400'
                        : 'bg-blue-50 dark:bg-blue-950/20 border-blue-400'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-xl shrink-0 mt-0.5">{task.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{task.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            {/* ── Feeding Guide ── */}
            <TabsContent value="feeding" className="space-y-2 mt-3">
              {feedingGuide.length === 0 ? (
                <div className="text-center py-10">
                  <Leaf className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <p className="text-sm font-medium text-foreground mb-1">No plants in your garden</p>
                  <p className="text-xs text-muted-foreground">Add plants to see their feeding requirements.</p>
                </div>
              ) : (
                <>
                  <p className="text-[11px] text-muted-foreground italic px-0.5">
                    Feeding guide for the plants in your current garden.
                  </p>
                  {feedingGuide.map(({ plantId, name, emoji, feedInfo, noFeed }) => (
                    <div key={plantId} className="p-3 rounded-lg border border-border bg-card space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{emoji}</span>
                        <span className="font-semibold text-sm text-foreground">{name}</span>
                        {noFeed && (
                          <Badge variant="outline" className="text-[10px] text-green-700 border-green-300 bg-green-50 dark:bg-green-950/30">
                            No feed needed
                          </Badge>
                        )}
                      </div>
                      {noFeed ? (
                        <p className="text-xs text-muted-foreground">
                          Legumes fix nitrogen from the air — they actually improve your soil. No fertiliser required.
                        </p>
                      ) : feedInfo ? (
                        <div className="space-y-1 text-xs">
                          <div className="grid grid-cols-[4rem_1fr] gap-x-2">
                            <span className="text-muted-foreground font-medium">Feed</span>
                            <span className="text-foreground">{feedInfo.feedType}</span>
                          </div>
                          <div className="grid grid-cols-[4rem_1fr] gap-x-2">
                            <span className="text-muted-foreground font-medium">Start</span>
                            <span className="text-foreground">{feedInfo.when}</span>
                          </div>
                          <div className="grid grid-cols-[4rem_1fr] gap-x-2">
                            <span className="text-muted-foreground font-medium">How often</span>
                            <span className="text-foreground">{feedInfo.frequency}</span>
                          </div>
                          {feedInfo.products && (
                            <div className="grid grid-cols-[4rem_1fr] gap-x-2">
                              <span className="text-muted-foreground font-medium">Products</span>
                              <span className="text-foreground text-primary/80">{feedInfo.products}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Use a general balanced fertiliser (e.g. Growmore or blood, fish & bone) in spring.
                        </p>
                      )}
                    </div>
                  ))}
                </>
              )}
            </TabsContent>

            {/* ── My Tasks ── */}
            <TabsContent value="my-tasks" className="space-y-3 mt-3">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {incomplete.length === 0 && completed.length === 0 && !adding && (
                    <p className="text-xs text-muted-foreground italic text-center py-4">
                      No custom tasks yet — add your own below.
                    </p>
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
          </Tabs>
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
