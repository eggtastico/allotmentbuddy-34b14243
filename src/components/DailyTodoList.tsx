import { useState, useEffect, useCallback, useRef } from 'react';
import { PlacedPlant } from '@/types/garden';
import { plants as plantDB } from '@/data/plants';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CheckSquare, Plus, ChevronDown, ChevronUp, MapPin, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PLANT_FEEDING, NO_FEED, isFeedingDay } from '@/utils/feedingGuide';

interface DailyTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  plant_name: string | null;
}

interface DailyTodoListProps {
  placedPlants: PlacedPlant[];
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

// skipTitles: titles of tasks already in the rollover — don't create duplicates
function buildDailyPayloads(
  userId: string,
  today: string,
  placedPlants: PlacedPlant[],
  skipTitles: Set<string>,
) {
  const now = new Date();
  const payloads: Array<{
    user_id: string;
    title: string;
    description: string;
    period: string;
    due_date: string;
    completed: boolean;
    plant_name?: string;
  }> = [];

  if (!skipTitles.has('Water the plants 💧')) {
    payloads.push({
      user_id: userId,
      title: 'Water the plants 💧',
      description: `${placedPlants.length} plant${placedPlants.length !== 1 ? 's' : ''} to check`,
      period: 'daily',
      due_date: today,
      completed: false,
    });
  }

  for (const pp of placedPlants) {
    if (pp.stage === 'established') continue;
    const plant = plantDB.find((p) => p.id === pp.plantId);
    if (!plant?.daysToHarvest) continue;
    const daysElapsed = Math.floor(
      (now.getTime() - new Date(pp.plantedAt).getTime()) / 86400000
    );
    const daysRemaining = plant.daysToHarvest - daysElapsed;
    if (daysRemaining >= 0 && daysRemaining <= 7) {
      const title = `Check ${plant.name} for harvest 🌾`;
      if (!skipTitles.has(title)) {
        payloads.push({
          user_id: userId,
          title,
          description:
            daysRemaining === 0
              ? 'Ready to harvest today!'
              : `About ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} until ready`,
          period: 'daily',
          due_date: today,
          completed: false,
          plant_name: plant.name,
        });
      }
    }
  }

  // Feeding reminders — one per unique plant type, shown on the right schedule interval
  const seenFeedPlants = new Set<string>();
  for (const pp of placedPlants) {
    if (seenFeedPlants.has(pp.plantId)) continue;
    if (NO_FEED.has(pp.plantId)) continue;
    const feedInfo = PLANT_FEEDING[pp.plantId];
    if (!feedInfo) continue;
    if (!isFeedingDay(pp.plantedAt, feedInfo.intervalDays)) continue;
    const plant = plantDB.find((p) => p.id === pp.plantId);
    if (!plant) continue;
    seenFeedPlants.add(pp.plantId);
    const title = `Feed ${plant.name} 🌿`;
    if (!skipTitles.has(title)) {
      payloads.push({
        user_id: userId,
        title,
        description: `${feedInfo.feedType} · ${feedInfo.frequency}${feedInfo.products ? ` · ${feedInfo.products}` : ''}`,
        period: 'daily',
        due_date: today,
        completed: false,
        plant_name: plant.name,
      });
    }
  }

  if (!skipTitles.has('Check for weeds 🌿')) {
    payloads.push({
      user_id: userId,
      title: 'Check for weeds 🌿',
      description: 'Remove any weeds before they go to seed',
      period: 'daily',
      due_date: today,
      completed: false,
    });
  }

  return payloads;
}

// ── Local persistence helpers ────────────────────────────────────────────────
const LOCAL_DAILY_KEY = 'allotment-daily-store-v2';

interface LocalDailyStore {
  date: string;                  // date auto-tasks were last generated
  completedAutoTitles: string[]; // which auto tasks were checked off today
  customTasks: DailyTask[];      // user-added tasks — persist until completed/deleted
}

function loadLocalStore(): LocalDailyStore {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_DAILY_KEY) || 'null') ?? {
      date: '', completedAutoTitles: [], customTasks: [],
    };
  } catch {
    return { date: '', completedAutoTitles: [], customTasks: [] };
  }
}

function saveLocalStore(store: LocalDailyStore) {
  localStorage.setItem(LOCAL_DAILY_KEY, JSON.stringify(store));
}

// ── Component ────────────────────────────────────────────────────────────────
export function DailyTodoList({ placedPlants }: DailyTodoListProps) {
  const { user } = useAuth();
  const today = toDateStr(new Date());

  const [collapsed, setCollapsed] = useState(false);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const loadDone = useRef(false);

  const visitingKey = `allotment-visiting-${today}`;
  const [visitingToday, setVisitingToday] = useState(
    () => localStorage.getItem(visitingKey) === 'true'
  );

  const toggleVisiting = () => {
    const next = !visitingToday;
    setVisitingToday(next);
    localStorage.setItem(visitingKey, String(next));
    if (next) toast.success('Happy gardening! 🌱');
  };

  const loadTasks = useCallback(async () => {
    if (loadDone.current) return;
    loadDone.current = true;

    // Without auth: use localStorage for persistence
    if (!user) {
      const store = loadLocalStore();
      const isNewDay = store.date !== today;

      // Auto-generated tasks, completion restored from store (or cleared on new day)
      const completedSet = isNewDay ? new Set<string>() : new Set(store.completedAutoTitles);
      const generated = buildDailyPayloads('local', today, placedPlants, new Set());
      const autoTasks: DailyTask[] = generated.map((p, i) => ({
        id: `auto-${i}`,
        title: p.title,
        description: p.description,
        due_date: today,
        completed: completedSet.has(p.title),
        plant_name: p.plant_name ?? null,
      }));

      // Custom tasks: persist across days — incomplete ones show as "rolled over"
      const customTasks = store.customTasks ?? [];

      setTasks([...autoTasks, ...customTasks]);

      if (isNewDay) {
        saveLocalStore({ date: today, completedAutoTitles: [], customTasks });
      }
      setLoading(false);
      return;
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);

    // Single query — fetch everything including completed, filter client-side
    const { data, error } = await supabase
      .from('garden_tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('period', 'daily')
      .gte('due_date', toDateStr(cutoff))
      .order('due_date', { ascending: true });

    if (error) { setLoading(false); return; }

    const all = (data ?? []) as DailyTask[];

    // hasTodayTasks uses the full unfiltered set (catches completed-today tasks too)
    const hasTodayTasks = all.some((t) => t.due_date === today);

    if (!hasTodayTasks && placedPlants.length > 0) {
      // Build skip set from incomplete rolled-over tasks to avoid duplicates
      const skipTitles = new Set(
        all.filter((t) => !t.completed).map((t) => t.title)
      );
      const payloads = buildDailyPayloads(user.id, today, placedPlants, skipTitles);

      if (payloads.length > 0) {
        await supabase.from('garden_tasks').insert(payloads);
        // Re-fetch to get server-assigned IDs for the new rows
        const { data: data2 } = await supabase
          .from('garden_tasks')
          .select('*')
          .eq('user_id', user.id)
          .eq('period', 'daily')
          .gte('due_date', toDateStr(cutoff))
          .order('due_date', { ascending: true });
        const all2 = (data2 ?? []) as DailyTask[];
        setTasks(all2.filter((t) => !t.completed || t.due_date === today));
      } else {
        // Every standard task already exists in the rollover — just display as-is
        setTasks(all.filter((t) => !t.completed || t.due_date === today));
      }
    } else {
      setTasks(all.filter((t) => !t.completed || t.due_date === today));
    }

    setLoading(false);
  }, [user, today, placedPlants]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const toggleComplete = async (task: DailyTask) => {
    const next = !task.completed;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: next } : t)));
    if (user) {
      await supabase.from('garden_tasks').update({ completed: next }).eq('id', task.id);
    } else {
      // Persist: auto tasks by title, custom tasks by updating the object
      const store = loadLocalStore();
      if (task.id.startsWith('auto-')) {
        const titles = new Set(store.completedAutoTitles);
        if (next) titles.add(task.title); else titles.delete(task.title);
        saveLocalStore({ ...store, completedAutoTitles: [...titles] });
      } else {
        const customTasks = store.customTasks.map(t =>
          t.id === task.id ? { ...t, completed: next } : t
        );
        saveLocalStore({ ...store, customTasks });
      }
    }
    if (next && visitingToday) toast.success('Task done! ✅');
  };

  const deleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (user) {
      await supabase.from('garden_tasks').delete().eq('id', id);
    } else {
      const store = loadLocalStore();
      saveLocalStore({ ...store, customTasks: store.customTasks.filter(t => t.id !== id) });
    }
  };

  const addTask = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    if (user) {
      const { data, error } = await supabase
        .from('garden_tasks')
        .insert({
          user_id: user.id,
          title: newTitle.trim(),
          period: 'daily',
          due_date: today,
          completed: false,
        })
        .select('*')
        .single();
      setSaving(false);
      if (error || !data) { toast.error('Failed to add task'); return; }
      setTasks((prev) => [...prev, data as DailyTask]);
    } else {
      // Custom tasks get no due_date — they persist until manually completed/deleted
      const task: DailyTask = {
        id: `custom-${Date.now()}`,
        title: newTitle.trim(),
        description: null,
        due_date: null,
        completed: false,
        plant_name: null,
      };
      setTasks((prev) => [...prev, task]);
      const store = loadLocalStore();
      saveLocalStore({ ...store, customTasks: [...store.customTasks, task] });
      setSaving(false);
    }
    setNewTitle('');
    setAdding(false);
  };

  const todayTasks = tasks.filter((t) => t.due_date === today);
  // Rolled-over: incomplete tasks from past days, plus persistent local custom tasks (no date)
  const rolledUp = tasks.filter(
    (t) => !t.completed && (t.due_date === null || t.due_date < today)
  );
  const incompleteCount = tasks.filter((t) => !t.completed).length;

  return (
    <div className="border-t border-border bg-background/50 backdrop-blur-sm">
      {/* Collapsible header */}
      <button
        className="w-full px-4 py-2 flex items-center gap-2 hover:bg-muted/50 transition-colors"
        onClick={() => setCollapsed((c) => !c)}
      >
        <CheckSquare className="h-4 w-4 text-primary flex-shrink-0" />
        <span className="text-xs font-bold text-foreground">Daily Tasks</span>
        {incompleteCount > 0 && (
          <Badge
            variant="secondary"
            className="text-[10px] h-5 px-2 rounded-full font-bold ml-1 bg-primary/20 text-primary"
          >
            {incompleteCount} to do
          </Badge>
        )}
        {visitingToday && (
          <Badge
            variant="secondary"
            className="text-[10px] h-5 px-2 rounded-full font-bold ml-1 bg-green-500/20 text-green-700 dark:text-green-400"
          >
            Visiting today
          </Badge>
        )}
        <span className="ml-auto text-muted-foreground">
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </span>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4">
          {/* Visiting today toggle */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
            <span className="text-xs text-muted-foreground">At the allotment today?</span>
            <button
              onClick={toggleVisiting}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${
                visitingToday
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'
              }`}
            >
              <MapPin className="h-3.5 w-3.5" />
              {visitingToday ? 'Visiting today ✓' : 'Mark as visiting'}
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              {/* Rolled-up tasks from previous days */}
              {rolledUp.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-accent uppercase tracking-wide mb-1.5">
                    Rolled over
                  </p>
                  <div className="space-y-1.5">
                    {rolledUp.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        today={today}
                        visiting={visitingToday}
                        onToggle={toggleComplete}
                        onDelete={deleteTask}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Today's tasks */}
              {todayTasks.length > 0 && (
                <div>
                  {rolledUp.length > 0 && (
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 mt-2">
                      Today
                    </p>
                  )}
                  <div className="space-y-1.5">
                    {todayTasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        today={today}
                        visiting={visitingToday}
                        onToggle={toggleComplete}
                        onDelete={deleteTask}
                      />
                    ))}
                  </div>
                </div>
              )}

              {tasks.length === 0 && (
                <p className="text-xs text-muted-foreground italic text-center py-2">
                  No tasks yet — add one below or place some plants to get started.
                </p>
              )}

              {/* Add task */}
              {adding ? (
                <div className="flex gap-1.5 pt-1">
                  <Input
                    autoFocus
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addTask();
                      if (e.key === 'Escape') setAdding(false);
                    }}
                    placeholder="New task…"
                    className="h-7 text-xs flex-1"
                  />
                  <Button
                    size="sm"
                    className="h-7 text-xs px-2"
                    disabled={saving || !newTitle.trim()}
                    onClick={addTask}
                  >
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
                  </Button>
                  <button
                    onClick={() => setAdding(false)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
                >
                  <Plus className="h-3 w-3" /> Add task
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  today,
  visiting,
  onToggle,
  onDelete,
}: {
  task: DailyTask;
  today: string;
  visiting: boolean;
  onToggle: (t: DailyTask) => void;
  onDelete: (id: string) => void;
}) {
  const isToday = task.due_date === today;
  const isOverdue = !isToday && task.due_date !== null && task.due_date < today;
  const isPersistent = task.due_date === null;

  return (
    <div
      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors ${
        task.completed
          ? 'bg-muted/20 opacity-60'
          : visiting && isToday
          ? 'bg-primary/10 border border-primary/30'
          : isOverdue
          ? 'bg-accent/10 border border-accent/20'
          : 'bg-card border border-border'
      }`}
    >
      <Checkbox
        checked={task.completed}
        onCheckedChange={() => onToggle(task)}
        className="flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p
          className={`text-xs font-medium truncate ${
            task.completed ? 'line-through text-muted-foreground' : 'text-foreground'
          }`}
        >
          {task.title}
        </p>
        {isOverdue && task.due_date && !task.completed && (
          <p className="text-[10px] text-accent mt-0.5">
            From{' '}
            {new Date(task.due_date + 'T12:00:00').toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
            })}
          </p>
        )}
        {isPersistent && !task.completed && (
          <p className="text-[10px] text-muted-foreground mt-0.5">Until completed</p>
        )}
        {task.description && !isOverdue && (
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{task.description}</p>
        )}
      </div>
      <button
        onClick={() => onDelete(task.id)}
        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex-shrink-0 transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
