import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlacedPlant, PestLog, PestSeverity } from '@/types/garden';
import { savePestLog, getPestLogs, updatePestLog, deletePestLog } from '@/lib/db';
import { getPlantById } from '@/data/plants';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Bug, CheckCircle2, AlertTriangle } from 'lucide-react';

interface PestDiseaseLogProps {
  onClose: () => void;
  placedPlants: PlacedPlant[];
  gardenId: string;
}

interface PestFormState {
  plantId: string;      // optional plant id from plants DB
  logDate: string;
  pestOrDisease: string;
  severity: PestSeverity;
  treatment: string;
  resolved: boolean;
  notes: string;
}

const emptyForm = (): PestFormState => ({
  plantId: '',
  logDate: new Date().toISOString().slice(0, 10),
  pestOrDisease: '',
  severity: 'medium',
  treatment: '',
  resolved: false,
  notes: '',
});

const SEVERITY_CONFIG: Record<PestSeverity, { label: string; className: string }> = {
  low: { label: 'Low', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  medium: { label: 'Medium', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  high: { label: 'High', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};

// Common UK allotment pests/diseases for autocomplete
const COMMON_PROBLEMS = [
  'Slugs', 'Snails', 'Aphids', 'Whitefly', 'Blackfly', 'Carrot fly', 'Cabbage white caterpillars',
  'Vine weevil', 'Red spider mite', 'Blight (potato/tomato)', 'Powdery mildew', 'Botrytis (grey mould)',
  'Club root', 'Damping off', 'Rust', 'Leaf miner', 'Flea beetle', 'Cutworm', 'Wireworm',
];

export function PestDiseaseLog({ onClose, placedPlants, gardenId }: PestDiseaseLogProps) {
  const [logs, setLogs] = useState<PestLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PestFormState>(emptyForm());
  const [filterResolved, setFilterResolved] = useState<'all' | 'active' | 'resolved'>('active');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const data = await getPestLogs(gardenId);
    setLogs(data.sort((a, b) => b.logDate.localeCompare(a.logDate)));
    setLoading(false);
  }, [gardenId]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Unique placed plants for the selector
  const plantOptions = placedPlants
    .map(pp => {
      const plant = getPlantById(pp.plantId);
      return plant ? { pp, plant } : null;
    })
    .filter(Boolean) as { pp: PlacedPlant; plant: NonNullable<ReturnType<typeof getPlantById>> }[];

  const handleSave = async () => {
    if (!form.pestOrDisease.trim()) {
      toast.error('Enter the pest or disease name');
      return;
    }
    setSaving(true);
    await savePestLog({
      gardenId,
      plantId: form.plantId || undefined,
      logDate: form.logDate,
      pestOrDisease: form.pestOrDisease.trim(),
      severity: form.severity,
      treatment: form.treatment.trim() || undefined,
      resolved: form.resolved,
      notes: form.notes.trim() || undefined,
    });
    toast.success('Problem logged');
    setForm(emptyForm());
    setShowForm(false);
    setSaving(false);
    await loadLogs();
  };

  const handleToggleResolved = async (log: PestLog) => {
    await updatePestLog(log.id, { resolved: !log.resolved });
    await loadLogs();
    toast.success(log.resolved ? 'Marked as active' : 'Marked as resolved');
  };

  const handleDelete = async (id: string) => {
    await deletePestLog(id);
    toast.success('Entry removed');
    await loadLogs();
  };

  const filteredLogs = logs.filter(l => {
    if (filterResolved === 'active') return !l.resolved;
    if (filterResolved === 'resolved') return l.resolved;
    return true;
  });

  const activeCount = logs.filter(l => !l.resolved).length;

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg w-full max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Bug className="h-4 w-4 text-orange-600" />
            Pest & Disease Log
            {activeCount > 0 && (
              <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-0 text-[10px] h-5 px-2">
                {activeCount} active
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 px-4 py-2 border-b">
          <Button size="sm" onClick={() => setShowForm(v => !v)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Log problem
          </Button>
          <div className="ml-auto flex gap-1">
            {(['active', 'all', 'resolved'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterResolved(f)}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                  filterResolved === f
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {showForm && (
          <div className="px-4 py-3 border-b bg-muted/30 space-y-3">
            {/* Pest/disease name */}
            <div className="space-y-1">
              <label className="text-xs font-medium">Pest / disease *</label>
              <Input
                list="pest-suggestions"
                placeholder="e.g. Slugs, Aphids, Blight…"
                value={form.pestOrDisease}
                onChange={e => setForm(f => ({ ...f, pestOrDisease: e.target.value }))}
                className="text-sm"
              />
              <datalist id="pest-suggestions">
                {COMMON_PROBLEMS.map(p => <option key={p} value={p} />)}
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Affected plant */}
              <div className="space-y-1">
                <label className="text-xs font-medium">Affected plant</label>
                <select
                  className="w-full text-sm border border-input rounded-md px-3 py-1.5 bg-background"
                  value={form.plantId}
                  onChange={e => setForm(f => ({ ...f, plantId: e.target.value }))}
                >
                  <option value="">Whole garden / unknown</option>
                  {/* Deduplicate by plantId */}
                  {Array.from(new Map(plantOptions.map(o => [o.plant.id, o])).values()).map(({ plant }) => (
                    <option key={plant.id} value={plant.id}>
                      {plant.emoji} {plant.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div className="space-y-1">
                <label className="text-xs font-medium">Date noticed</label>
                <Input
                  type="date"
                  value={form.logDate}
                  onChange={e => setForm(f => ({ ...f, logDate: e.target.value }))}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Severity */}
              <div className="space-y-1">
                <label className="text-xs font-medium">Severity</label>
                <div className="flex gap-1">
                  {(['low', 'medium', 'high'] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, severity: s }))}
                      className={`flex-1 text-xs py-1 rounded-md border transition-colors ${
                        form.severity === s
                          ? SEVERITY_CONFIG[s].className + ' border-current'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {SEVERITY_CONFIG[s].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolved toggle */}
              <div className="space-y-1">
                <label className="text-xs font-medium">Status</label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={form.resolved}
                    onCheckedChange={v => setForm(f => ({ ...f, resolved: !!v }))}
                  />
                  Already resolved
                </label>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Treatment applied</label>
              <Input
                placeholder="e.g. Nematodes, copper tape, hand-picked…"
                value={form.treatment}
                onChange={e => setForm(f => ({ ...f, treatment: e.target.value }))}
                className="text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Notes</label>
              <Textarea
                placeholder="Extent, observations, what worked…"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="text-sm resize-none"
                rows={2}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setForm(emptyForm()); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
              </Button>
            </div>
          </div>
        )}

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground px-4">
              {filterResolved === 'active'
                ? 'No active problems — garden is clean!'
                : filterResolved === 'resolved'
                ? 'No resolved entries yet.'
                : 'No problems logged yet.'}
            </div>
          ) : (
            <div className="divide-y">
              {filteredLogs.map(log => {
                const plant = log.plantId ? getPlantById(log.plantId) : null;
                return (
                  <div key={log.id} className={`px-4 py-3 flex items-start gap-3 ${log.resolved ? 'opacity-60' : ''}`}>
                    <div className="mt-0.5 shrink-0">
                      {log.resolved
                        ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                        : <AlertTriangle className={`h-4 w-4 ${log.severity === 'high' ? 'text-red-500' : log.severity === 'medium' ? 'text-orange-500' : 'text-yellow-500'}`} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{log.pestOrDisease}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.logDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] h-4 px-1.5 border-0 ${SEVERITY_CONFIG[log.severity].className}`}
                        >
                          {SEVERITY_CONFIG[log.severity].label}
                        </Badge>
                        {plant && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                            {plant.emoji} {plant.name}
                          </Badge>
                        )}
                        {log.resolved && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            Resolved
                          </Badge>
                        )}
                      </div>
                      {log.treatment && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Treatment: {log.treatment}
                        </p>
                      )}
                      {log.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.notes}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => handleToggleResolved(log)}
                        title={log.resolved ? 'Mark as active' : 'Mark as resolved'}
                        className="text-muted-foreground hover:text-green-600 transition-colors"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(log.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
