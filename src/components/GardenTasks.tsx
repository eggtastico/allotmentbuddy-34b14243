import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, Loader2, ListTodo, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';

interface Task {
  id: string;
  title: string;
  description: string;
  due_date: string | null;
  period: string;
  completed: boolean;
  plant_name: string;
}

interface GardenTasksProps {
  onClose: () => void;
}

export function GardenTasks({ onClose }: GardenTasksProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPeriod, setNewPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [newDueDate, setNewDueDate] = useState('');
  const [tab, setTab] = useState('weekly');

  const fetchTasks = async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase.from('garden_tasks').select('*').order('created_at', { ascending: false });
    if (data) setTasks(data as Task[]);
    setLoading(false);
  };

  useEffect(() => { fetchTasks(); }, [user]);

  const addTask = async () => {
    if (!user || !newTitle.trim()) return;
    const { error } = await supabase.from('garden_tasks').insert({
      user_id: user.id,
      title: newTitle.trim(),
      description: newDesc.trim(),
      period: newPeriod,
      due_date: newDueDate || null,
    });
    if (error) { toast.error('Failed to add task'); return; }
    setNewTitle(''); setNewDesc(''); setNewDueDate(''); setAdding(false);
    toast.success('Task added! ✅');
    fetchTasks();
  };

  const toggleComplete = async (task: Task) => {
    await supabase.from('garden_tasks').update({ completed: !task.completed }).eq('id', task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTask = async (id: string) => {
    await supabase.from('garden_tasks').delete().eq('id', id);
    setTasks(prev => prev.filter(t => t.id !== id));
    toast.success('Task removed');
  };

  const filtered = (period: string, showCompleted: boolean) =>
    tasks.filter(t => t.period === period && t.completed === showCompleted);

  const TaskList = ({ items }: { items: Task[] }) => (
    <div className="space-y-2">
      {items.length === 0 && <p className="text-xs text-muted-foreground italic">No tasks here yet.</p>}
      {items.map(task => (
        <div key={task.id} className={`flex items-start gap-2 p-2.5 rounded-lg border border-border ${task.completed ? 'opacity-50 bg-muted/30' : 'bg-card'}`}>
          <Checkbox checked={task.completed} onCheckedChange={() => toggleComplete(task)} className="mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{task.title}</p>
            {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
            {task.due_date && <Badge variant="outline" className="text-[10px] mt-1">{new Date(task.due_date).toLocaleDateString('en-GB')}</Badge>}
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => deleteTask(task.id)}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      ))}
    </div>
  );

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" /> Garden Tasks
          </DialogTitle>
        </DialogHeader>

        {!user ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sign in to manage your garden tasks.</p>
        ) : loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="w-full">
                <TabsTrigger value="weekly" className="flex-1 text-xs"><CalendarDays className="h-3.5 w-3.5 mr-1" /> Weekly</TabsTrigger>
                <TabsTrigger value="monthly" className="flex-1 text-xs"><CalendarDays className="h-3.5 w-3.5 mr-1" /> Monthly</TabsTrigger>
                <TabsTrigger value="completed" className="flex-1 text-xs">✅ Done</TabsTrigger>
              </TabsList>

              <TabsContent value="weekly" className="space-y-3 mt-3">
                <TaskList items={filtered('weekly', false)} />
              </TabsContent>
              <TabsContent value="monthly" className="space-y-3 mt-3">
                <TaskList items={filtered('monthly', false)} />
              </TabsContent>
              <TabsContent value="completed" className="space-y-3 mt-3">
                <TaskList items={[...filtered('weekly', true), ...filtered('monthly', true)]} />
              </TabsContent>
            </Tabs>

            {adding ? (
              <div className="space-y-2 p-3 border border-border rounded-lg bg-muted/30">
                <Input placeholder="Task title" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="text-sm" />
                <Textarea placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="text-sm min-h-[60px]" />
                <div className="flex gap-2">
                  <Input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} className="text-sm flex-1" />
                  <select value={newPeriod} onChange={e => setNewPeriod(e.target.value as 'weekly' | 'monthly')} className="text-sm border rounded px-2 bg-background text-foreground">
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addTask} disabled={!newTitle.trim()}>Add Task</Button>
                  <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="w-full" onClick={() => setAdding(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Task
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
