import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { PlacedPlant } from '@/types/garden';
import { plants as plantDB } from '@/data/plants';
import { getSuccessionTasks } from '@/utils/bedPlantSuggestions';
import { ChevronDown, ChevronUp, Droplets, Sprout, Scissors, Lightbulb, CheckSquare, Plus, X, Loader2, MapPin } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { PLANT_FEEDING, NO_FEED } from '@/utils/feedingGuide';
import { toast } from 'sonner';
import { generateAllTasks, generateWeeklyFeedingSchedule, generateMonthlyFeedingSchedule } from '@/utils/gardenTaskGeneration';
import type { GeneratedTask } from '@/utils/gardenTaskGeneration';

interface DailyTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  plant_name: string | null;
}

interface GardenAssistantPanelProps {
  placedPlants: PlacedPlant[];
  frostDates?: { lastSpringFrost?: string; firstFallFrost?: string } | null;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LOCAL_DAILY_KEY = 'allotment-daily-store-v2';

interface LocalDailyStore {
  date: string;
  completedAutoTitles: string[];
  customTasks: DailyTask[];
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
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

  const seenFeedPlants = new Set<string>();
  for (const pp of placedPlants) {
    if (seenFeedPlants.has(pp.plantId)) continue;
    if (NO_FEED.has(pp.plantId)) continue;
    const feedInfo = PLANT_FEEDING[pp.plantId];
    if (!feedInfo) continue;
    const plant = plantDB.find((p) => p.id === pp.plantId);
    if (!plant) continue;
    seenFeedPlants.add(pp.plantId);
    const title = `Feed ${plant.name} 🌿`;
    if (!skipTitles.has(title)) {
      payloads.push({
        user_id: userId,
        title,
        description: `${feedInfo.feedType} · ${feedInfo.frequency}`,
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
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(true);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [visitingToday, setVisitingToday] = useState(
    () => localStorage.getItem(`allotment-visiting-${toDateStr(new Date())}`) === 'true'
  );
  const [insights, setInsights] = useState<GeneratedTask[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [weeklyFeeding, setWeeklyFeeding] = useState<GeneratedTask[]>([]);
  const [monthlyFeeding, setMonthlyFeeding] = useState<GeneratedTask[]>([]);
  const loadDone = useRef(false);

  const today = new Date();
  const todayStr = toDateStr(today);
  const currentMonth = MONTH_NAMES[today.getMonth()];
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = `${dayName}, ${today.getDate()} ${currentMonth} ${today.getFullYear()}`;

  // Load tasks
  const loadTasks = useCallback(async () => {
    if (loadDone.current) return;
    loadDone.current = true;

    if (!user) {
      const store = loadLocalStore();
      const isNewDay = store.date !== todayStr;

      const completedSet = isNewDay ? new Set<string>() : new Set(store.completedAutoTitles);
      const generated = buildDailyPayloads('local', todayStr, placedPlants, new Set());
      const autoTasks: DailyTask[] = generated.map((p, i) => ({
        id: `auto-${i}`,
        title: p.title,
        description: p.description,
        due_date: todayStr,
        completed: completedSet.has(p.title),
        plant_name: p.plant_name ?? null,
      }));

      const customTasks = store.customTasks ?? [];
      setTasks([...autoTasks, ...customTasks]);

      if (isNewDay) {
        saveLocalStore({ date: todayStr, completedAutoTitles: [], customTasks });
      }
      setLoading(false);
      return;
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);

    const { data, error } = await supabase
      .from('garden_tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('period', 'daily')
      .gte('due_date', toDateStr(cutoff))
      .order('due_date', { ascending: true });

    if (error) {
      setLoading(false);
      return;
    }

    const all = (data ?? []) as DailyTask[];
    const hasTodayTasks = all.some((t) => t.due_date === todayStr);

    if (!hasTodayTasks && placedPlants.length > 0) {
      const skipTitles = new Set(
        all.filter((t) => !t.completed).map((t) => t.title)
      );
      const payloads = buildDailyPayloads(user.id, todayStr, placedPlants, skipTitles);

      if (payloads.length > 0) {
        await supabase.from('garden_tasks').insert(payloads);
        const { data: data2 } = await supabase
          .from('garden_tasks')
          .select('*')
          .eq('user_id', user.id)
          .eq('period', 'daily')
          .gte('due_date', toDateStr(cutoff))
          .order('due_date', { ascending: true });
        const all2 = (data2 ?? []) as DailyTask[];
        setTasks(all2.filter((t) => !t.completed || t.due_date === todayStr));
      } else {
        setTasks(all.filter((t) => !t.completed || t.due_date === todayStr));
      }
    } else {
      setTasks(all.filter((t) => !t.completed || t.due_date === todayStr));
    }

    setLoading(false);
  }, [user, todayStr, placedPlants]);

  // Load insights
  useEffect(() => {
    const loadInsights = async () => {
      if (placedPlants.length === 0) {
        setInsights([]);
        setInsightsLoading(false);
        return;
      }

      try {
        // Get location from localStorage if available
        const locStr = localStorage.getItem('ab-location');
        let location = null;
        if (locStr) {
          try {
            location = JSON.parse(locStr);
          } catch (e) {
            console.warn('Failed to parse location:', e);
          }
        }

        const tasks = await generateAllTasks(placedPlants, location);
        const weekFeeding = generateWeeklyFeedingSchedule(placedPlants);
        const monthFeeding = generateMonthlyFeedingSchedule(placedPlants);
        setInsights(tasks);
        setWeeklyFeeding(weekFeeding);
        setMonthlyFeeding(monthFeeding);
      } catch (error) {
        console.error('Failed to generate insights:', error);
        setInsights([]);
        setWeeklyFeeding([]);
        setMonthlyFeeding([]);
      } finally {
        setInsightsLoading(false);
      }
    };

    loadInsights();
  }, [placedPlants]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const toggleComplete = async (task: DailyTask) => {
    const next = !task.completed;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: next } : t)));
    if (user) {
      await supabase.from('garden_tasks').update({ completed: next }).eq('id', task.id);
    } else {
      const store = loadLocalStore();
      if (task.id.startsWith('auto-')) {
        const titles = new Set(store.completedAutoTitles);
        if (next) titles.add(task.title);
        else titles.delete(task.title);
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
          due_date: todayStr,
          completed: false,
        })
        .select('*')
        .single();
      setSaving(false);
      if (error || !data) {
        toast.error('Failed to add task');
        return;
      }
      setTasks((prev) => [...prev, data as DailyTask]);
    } else {
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

  const toggleVisiting = () => {
    const next = !visitingToday;
    setVisitingToday(next);
    localStorage.setItem(`allotment-visiting-${todayStr}`, String(next));
    if (next) toast.success('Happy gardening! 🌱');
  };

  const todayTasks = tasks.filter((t) => t.due_date === todayStr);
  const incompleteCount = tasks.filter((t) => !t.completed).length;

  // Count unique plants needing feeding
  const feedingPlantIds = new Set(weeklyFeeding.map(t => {
    const match = t.id.match(/feed-week-(\w+)/);
    return match ? match[1] : null;
  }).filter(Boolean));

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
        <span className="text-sm font-semibold">🌾 Allotment Tasks Assistant</span>
        <span className="text-xs text-blue-100">•</span>
        <span className="text-xs text-blue-100">{dateStr}</span>

        {/* Quick summary badges */}
        {incompleteCount > 0 && (
          <Badge className="bg-orange-500 text-white hover:bg-orange-600">
            ✓ {incompleteCount} tasks
          </Badge>
        )}
        {taskData.readyNow.length > 0 && (
          <Badge className="bg-green-500 text-white hover:bg-green-600">
            🔴 {taskData.readyNow.length} ready
          </Badge>
        )}
        {feedingPlantIds.size > 0 && (
          <Badge className="bg-emerald-400 text-white hover:bg-emerald-500">
            🌿 {feedingPlantIds.size} to feed
          </Badge>
        )}
        {taskData.toSow.length > 0 && (
          <Badge className="bg-blue-400 text-white hover:bg-blue-500">
            🌱 {taskData.toSow.length} sow
          </Badge>
        )}
        {incompleteCount === 0 && taskData.readyNow.length === 0 && taskData.totalPlanted > 0 && (
          <span className="text-xs text-blue-100">All tasks done!</span>
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

            {/* TODAY - Task Management */}
            <TabsContent value="today" className="p-4 space-y-4">
              {/* Visiting toggle */}
              <div className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg">
                <span className="text-xs text-muted-foreground">At the allotment today?</span>
                <button
                  onClick={toggleVisiting}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${
                    visitingToday
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:bg-primary/10 hover:text-primary'
                  }`}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {visitingToday ? 'Visiting today ✓' : 'Mark as visiting'}
                </button>
              </div>

              {/* Task list */}
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  {todayTasks.length > 0 ? (
                    <>
                      {todayTasks.map((task) => (
                        <div
                          key={task.id}
                          className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg transition-colors ${
                            task.completed
                              ? 'bg-muted/20 opacity-60'
                              : visitingToday
                              ? 'bg-primary/10 border border-primary/30'
                              : 'bg-card border border-border'
                          }`}
                        >
                          <Checkbox
                            checked={task.completed}
                            onCheckedChange={() => toggleComplete(task)}
                            className="flex-shrink-0 mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-xs font-medium ${
                                task.completed ? 'line-through text-muted-foreground' : 'text-foreground'
                              }`}
                            >
                              {task.title}
                            </p>
                            {task.description && !task.completed && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">{task.description}</p>
                            )}
                          </div>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex-shrink-0 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}

                      {/* Add task input */}
                      {adding ? (
                        <div className="flex gap-1.5">
                          <Input
                            autoFocus
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') addTask();
                              if (e.key === 'Escape') setAdding(false);
                            }}
                            placeholder="New task…"
                            className="h-8 text-xs flex-1"
                          />
                          <Button
                            size="sm"
                            className="h-8 text-xs px-2"
                            disabled={saving || !newTitle.trim()}
                            onClick={addTask}
                          >
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
                          </Button>
                          <button
                            onClick={() => setAdding(false)}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAdding(true)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Plus className="h-3 w-3" /> Add task
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="p-3 bg-muted rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">No tasks yet — add one below to get started!</p>
                    </div>
                  )}
                </div>
              )}

              {/* AI Insights - Weather & Feeding & Pest Prevention */}
              {placedPlants.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1">
                    <Lightbulb className="h-3.5 w-3.5 text-yellow-600" />
                    Smart Insights
                  </div>

                  {insightsLoading ? (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    </div>
                  ) : insights.length > 0 ? (
                    <div className="grid gap-2">
                      {insights.map((insight) => {
                        const bgColors = {
                          weather: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800',
                          feeding: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800',
                          pest: 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800',
                          harvest: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800',
                          general: 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800',
                        };

                        return (
                          <div
                            key={insight.id}
                            className={`p-3 rounded-lg border text-xs ${bgColors[insight.category]}`}
                          >
                            <p className="font-medium text-foreground">{insight.icon} {insight.title}</p>
                            <p className="text-muted-foreground mt-1 leading-snug">{insight.description}</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-2 text-xs text-muted-foreground italic">
                      No current insights. Keep watching for seasonal tasks and weather alerts.
                    </div>
                  )}

                  {/* Quick status bullets */}
                  {taskData.readyNow.length > 0 && (
                    <div className="p-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <p className="text-xs text-muted-foreground">
                        <strong>Ready to harvest:</strong> {taskData.readyNow.map(h => h.plant.emoji).join(' ')}
                      </p>
                    </div>
                  )}

                  {taskData.soonThisWeek.length > 0 && (
                    <div className="p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <p className="text-xs text-muted-foreground">
                        <strong>Harvest soon:</strong> {taskData.soonThisWeek.slice(0, 3).map(h => `${h.plant.emoji} ${h.daysRemaining}d`).join(', ')}
                      </p>
                    </div>
                  )}
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

              {weeklyFeeding.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Sprout className="h-4 w-4 text-green-600" />
                    Feeding Schedule This Week
                  </div>
                  <div className="grid gap-2">
                    {weeklyFeeding.map(task => (
                      <div key={task.id} className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <p className="font-medium text-sm text-foreground">{task.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
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

              {taskData.soonThisWeek.length === 0 && weeklyFeeding.length === 0 && taskData.successionAlerts.length === 0 && (
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

                  {monthlyFeeding.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Sprout className="h-4 w-4 text-green-600" />
                        Feeding Schedule This Month
                      </div>
                      <div className="grid gap-2">
                        {monthlyFeeding.map(task => (
                          <div key={task.id} className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                            <p className="font-medium text-sm text-foreground">{task.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                          </div>
                        ))}
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
