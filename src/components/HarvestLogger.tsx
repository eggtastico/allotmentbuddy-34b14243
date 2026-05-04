import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlacedPlant } from '@/types/garden';
import { HarvestLog } from '@/types/garden';
import {
  saveHarvestLog,
  getHarvestLogs,
  deleteHarvestLog,
} from '@/lib/db';
import { getPlantById } from '@/data/plants';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Leaf, Scale, Star } from 'lucide-react';

interface HarvestLoggerProps {
  onClose: () => void;
  placedPlants: PlacedPlant[];
  gardenId: string;
}

interface HarvestFormState {
  placedPlantId: string;
  harvestDate: string;
  quantityHarvested: string;
  weightGrams: string;
  qualityRating: 1 | 2 | 3 | 4 | 5 | 0;
  notes: string;
}

const emptyForm = (): HarvestFormState => ({
  placedPlantId: '',
  harvestDate: new Date().toISOString().slice(0, 10),
  quantityHarvested: '',
  weightGrams: '',
  qualityRating: 0,
  notes: '',
});

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: 1 | 2 | 3 | 4 | 5) => void;
}) {
  return (
    <div className="flex gap-1">
      {([1, 2, 3, 4, 5] as const).map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`text-xl transition-colors ${n <= value ? 'text-amber-400' : 'text-muted-foreground/30'} hover:text-amber-400`}
        >
          <Star className="h-5 w-5 fill-current" />
        </button>
      ))}
    </div>
  );
}

export function HarvestLogger({ onClose, placedPlants, gardenId }: HarvestLoggerProps) {
  const [logs, setLogs] = useState<HarvestLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<HarvestFormState>(emptyForm());

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const data = await getHarvestLogs(gardenId);
    setLogs(data.sort((a, b) => b.harvestDate.localeCompare(a.harvestDate)));
    setLoading(false);
  }, [gardenId]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Unique placed plants with their plant data
  const plantOptions = placedPlants
    .map(pp => {
      const plant = getPlantById(pp.plantId);
      return plant ? { pp, plant } : null;
    })
    .filter(Boolean) as { pp: PlacedPlant; plant: ReturnType<typeof getPlantById> & object }[];

  const handleSave = async () => {
    if (!form.placedPlantId) {
      toast.error('Select a plant to log a harvest for');
      return;
    }
    const placed = placedPlants.find(p => p.id === form.placedPlantId);
    if (!placed) return;

    setSaving(true);
    await saveHarvestLog({
      gardenId,
      plantId: placed.plantId,
      placedPlantId: placed.id,
      harvestDate: form.harvestDate,
      quantityHarvested: form.quantityHarvested ? Number(form.quantityHarvested) : undefined,
      weightGrams: form.weightGrams ? Number(form.weightGrams) : undefined,
      qualityRating: form.qualityRating || undefined,
      notes: form.notes.trim() || undefined,
    });
    toast.success('Harvest logged');
    setForm(emptyForm());
    setShowForm(false);
    setSaving(false);
    await loadLogs();
  };

  const handleDelete = async (id: string) => {
    await deleteHarvestLog(id);
    toast.success('Entry removed');
    await loadLogs();
  };

  // Group logs by plant type for the stats tab
  const statsByPlant = logs.reduce<
    Record<string, { plant: ReturnType<typeof getPlantById>; count: number; totalWeight: number; logs: HarvestLog[] }>
  >((acc, log) => {
    const plant = getPlantById(log.plantId);
    if (!plant) return acc;
    if (!acc[log.plantId]) {
      acc[log.plantId] = { plant, count: 0, totalWeight: 0, logs: [] };
    }
    acc[log.plantId].count += log.quantityHarvested ?? 1;
    acc[log.plantId].totalWeight += log.weightGrams ?? 0;
    acc[log.plantId].logs.push(log);
    return acc;
  }, {});

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg w-full max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Leaf className="h-4 w-4 text-green-600" />
            Harvest Log
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="log" className="flex flex-col flex-1 min-h-0">
          <TabsList className="mx-4 mt-2 mb-0 self-start">
            <TabsTrigger value="log">Log ({logs.length})</TabsTrigger>
            <TabsTrigger value="stats">Stats</TabsTrigger>
          </TabsList>

          {/* ── Log Tab ── */}
          <TabsContent value="log" className="flex-1 flex flex-col min-h-0 mt-0">
            <div className="px-4 py-2 border-b">
              <Button
                size="sm"
                onClick={() => setShowForm(v => !v)}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Log harvest
              </Button>
            </div>

            {showForm && (
              <div className="px-4 py-3 border-b bg-muted/30 space-y-3">
                {/* Plant selector */}
                <div className="space-y-1">
                  <label className="text-xs font-medium">Plant</label>
                  <select
                    className="w-full text-sm border border-input rounded-md px-3 py-1.5 bg-background"
                    value={form.placedPlantId}
                    onChange={e => setForm(f => ({ ...f, placedPlantId: e.target.value }))}
                  >
                    <option value="">Select a plant…</option>
                    {plantOptions.map(({ pp, plant }) => (
                      <option key={pp.id} value={pp.id}>
                        {plant!.emoji} {plant!.name}{plant!.variety ? ` (${plant!.variety})` : ''} — planted {new Date(pp.plantedAt).toLocaleDateString('en-GB')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Harvest date</label>
                    <Input
                      type="date"
                      value={form.harvestDate}
                      onChange={e => setForm(f => ({ ...f, harvestDate: e.target.value }))}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Quantity harvested</label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="e.g. 6"
                      value={form.quantityHarvested}
                      onChange={e => setForm(f => ({ ...f, quantityHarvested: e.target.value }))}
                      className="text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium flex items-center gap-1">
                      <Scale className="h-3 w-3" /> Weight (grams)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="e.g. 500"
                      value={form.weightGrams}
                      onChange={e => setForm(f => ({ ...f, weightGrams: e.target.value }))}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Quality</label>
                    <StarRating
                      value={form.qualityRating}
                      onChange={v => setForm(f => ({ ...f, qualityRating: v }))}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">Notes</label>
                  <Textarea
                    placeholder="Flavour, size, anything unusual…"
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
              ) : logs.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground px-4">
                  No harvests logged yet. Hit "Log harvest" to record your first pick.
                </div>
              ) : (
                <div className="divide-y">
                  {logs.map(log => {
                    const plant = getPlantById(log.plantId);
                    return (
                      <div key={log.id} className="px-4 py-3 flex items-start gap-3">
                        <span className="text-xl shrink-0">{plant?.emoji ?? '🌱'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-sm font-semibold">{plant?.name ?? log.plantId}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(log.harvestDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {log.quantityHarvested != null && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                                ×{log.quantityHarvested}
                              </Badge>
                            )}
                            {log.weightGrams != null && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                                {log.weightGrams >= 1000
                                  ? `${(log.weightGrams / 1000).toFixed(2)}kg`
                                  : `${log.weightGrams}g`}
                              </Badge>
                            )}
                            {log.qualityRating != null && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                                {'★'.repeat(log.qualityRating)}{'☆'.repeat(5 - log.qualityRating)}
                              </Badge>
                            )}
                          </div>
                          {log.notes && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.notes}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDelete(log.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-0.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* ── Stats Tab ── */}
          <TabsContent value="stats" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full">
              {Object.keys(statsByPlant).length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground px-4">
                  Log some harvests to see your season stats here.
                </div>
              ) : (
                <div className="divide-y">
                  {Object.entries(statsByPlant).map(([plantId, stats]) => {
                    const plant = stats.plant;
                    const avgQuality =
                      stats.logs.filter(l => l.qualityRating).length > 0
                        ? stats.logs.reduce((s, l) => s + (l.qualityRating ?? 0), 0) /
                          stats.logs.filter(l => l.qualityRating).length
                        : null;

                    return (
                      <div key={plantId} className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">{plant!.emoji}</span>
                          <span className="font-semibold text-sm">{plant!.name}</span>
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 ml-auto">
                            {stats.logs.length} harvest{stats.logs.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-muted/50 rounded-lg py-2">
                            <div className="text-sm font-bold">{stats.count}</div>
                            <div className="text-[10px] text-muted-foreground">picked</div>
                          </div>
                          <div className="bg-muted/50 rounded-lg py-2">
                            <div className="text-sm font-bold">
                              {stats.totalWeight >= 1000
                                ? `${(stats.totalWeight / 1000).toFixed(1)}kg`
                                : stats.totalWeight > 0
                                ? `${stats.totalWeight}g`
                                : '—'}
                            </div>
                            <div className="text-[10px] text-muted-foreground">weight</div>
                          </div>
                          <div className="bg-muted/50 rounded-lg py-2">
                            <div className="text-sm font-bold">
                              {avgQuality != null ? avgQuality.toFixed(1) + '★' : '—'}
                            </div>
                            <div className="text-[10px] text-muted-foreground">avg quality</div>
                          </div>
                        </div>
                        {plant!.yieldPerPlant && (
                          <p className="text-[10px] text-muted-foreground mt-1.5">
                            Expected yield: ~{plant!.yieldPerPlant} per plant
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
