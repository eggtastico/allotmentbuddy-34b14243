import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { plants as allPlants } from '@/data/plants';
import { PlacedStructure } from '@/types/garden';
import { getStructureById } from '@/data/structures';
import { AutomationPlan } from '@/utils/automationPlannerUtils';
import { GARDEN_ROTATION } from '@/utils/bedRotationUtils';
import { ChevronRight, ChevronLeft, Sprout, Bot, Trash2, Plus, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';

// ── Constants ─────────────────────────────────────────────────────────────────

const ROTATION_GROUPS_ORDER = ['legumes', 'brassicas', 'solanaceae', 'alliums', 'roots', 'cucurbits', 'leafy', 'other'];

function rotationLabel(group: string): string {
  const entry = GARDEN_ROTATION.find(r => r.plantGroups.includes(group));
  return entry ? `${entry.emoji} ${entry.label}` : group.charAt(0).toUpperCase() + group.slice(1);
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface AutomationPlannerProps {
  placedStructures: PlacedStructure[];
  activePlans: AutomationPlan[];
  onPreview: (cropIds: string[], bedIds: string[]) => AutomationPlan;
  onCommit: (plan: AutomationPlan) => void;
  onRemove: (planId: string) => void;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AutomationPlanner({
  placedStructures,
  activePlans,
  onPreview,
  onCommit,
  onRemove,
  onClose,
}: AutomationPlannerProps) {
  // 'list' shows active plans; 'new' runs the 3-step wizard
  const [mode, setMode] = useState<'list' | 'new'>(() => activePlans.length === 0 ? 'new' : 'list');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedCropIds, setSelectedCropIds] = useState<Set<string>>(new Set());
  const [managedBedIds, setManagedBedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<AutomationPlan | null>(null);

  const growingBeds = useMemo(
    () => placedStructures.filter(s => getStructureById(s.structureId)?.showCells),
    [placedStructures],
  );

  const plantsByGroup = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? allPlants.filter(p => p.name.toLowerCase().includes(q)) : allPlants;
    const groups: Record<string, typeof allPlants> = {};
    for (const plant of filtered) {
      const g = plant.rotationGroup ?? 'other';
      (groups[g] ??= []).push(plant);
    }
    return groups;
  }, [search]);

  const orderedGroupKeys = useMemo(
    () => ROTATION_GROUPS_ORDER.filter(g => plantsByGroup[g]?.length),
    [plantsByGroup],
  );

  const toggleCrop = (id: string) =>
    setSelectedCropIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleBed = (id: string) =>
    setManagedBedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const startNew = () => {
    setStep(1);
    setSelectedCropIds(new Set());
    setManagedBedIds(new Set());
    setSearch('');
    setPreview(null);
    setMode('new');
  };

  const goToStep2 = () => setStep(2);

  const goToStep3 = () => {
    const plan = onPreview([...selectedCropIds], [...managedBedIds]);
    setPreview(plan);
    setStep(3);
  };

  const handleCommit = () => {
    if (!preview) return;
    onCommit(preview);
    const cropCount = preview.selectedCropIds.length;
    const bedCount = preview.managedBedIds.length;
    const taskCount = preview.tasks.length;
    toast.success(`Automation activated — ${cropCount} crop${cropCount !== 1 ? 's' : ''}, ${bedCount} bed${bedCount !== 1 ? 's' : ''}, ${taskCount} task${taskCount !== 1 ? 's' : ''} in your task list`);
    onClose();
  };

  const stepLabels: Record<number, string> = {
    1: 'Select Crops',
    2: 'Select Beds',
    3: 'Confirm & Activate',
  };

  // ── Crop name lookup for confirmation summary
  const selectedCropDetails = useMemo(
    () => allPlants.filter(p => selectedCropIds.has(p.id)),
    [selectedCropIds],
  );

  const selectedBedDetails = useMemo(
    () => growingBeds.filter((b, idx) => managedBedIds.has(b.id)).map((b, idx) => ({
      bed: b,
      name: b.name || `Bed ${growingBeds.indexOf(b) + 1}`,
      structure: getStructureById(b.structureId),
    })),
    [managedBedIds, growingBeds],
  );

  // ── List mode: show active plans ──────────────────────────────────────────

  if (mode === 'list') {
    return (
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <div className="shrink-0 space-y-1">
            <div className="flex items-center gap-2 pr-6">
              <Bot className="h-5 w-5 text-primary shrink-0" />
              <DialogTitle className="text-base font-semibold leading-none tracking-tight">
                Automation Planner
              </DialogTitle>
            </div>
            <p className="text-xs text-muted-foreground">
              Active automations — beds managed by the app with auto-generated tasks.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 -mx-6 px-6">
            {activePlans.length === 0 ? (
              <div className="text-center py-10">
                <Bot className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium text-foreground mb-1">No automations set up yet</p>
                <p className="text-[11px] text-muted-foreground">Add your first automation to get started.</p>
              </div>
            ) : (
              <div className="space-y-3 py-1">
                {activePlans.map((plan, idx) => {
                  const cropNames = allPlants.filter(p => plan.selectedCropIds.includes(p.id));
                  const bedNames = growingBeds
                    .filter(b => plan.managedBedIds.includes(b.id))
                    .map((b, i) => b.name || `Bed ${growingBeds.indexOf(b) + 1}`);
                  const pending = plan.tasks.filter(t => !t.completed).length;
                  return (
                    <div key={plan.id} className="p-3 rounded-lg border border-border bg-card space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-primary shrink-0" />
                          <span className="text-sm font-semibold text-foreground">
                            Automation {idx + 1}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="secondary" className="text-[10px]">{pending} pending</Badge>
                          <Button
                            variant="ghost" size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => { onRemove(plan.id); toast.success('Automation removed'); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1 pl-6">
                        <p className="text-[11px] text-muted-foreground">
                          <span className="font-medium text-foreground">Crops: </span>
                          {cropNames.slice(0, 5).map(p => `${p.emoji} ${p.name}`).join(', ')}
                          {cropNames.length > 5 && ` +${cropNames.length - 5} more`}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          <span className="font-medium text-foreground">Beds: </span>
                          {bedNames.length > 0 ? bedNames.join(', ') : 'Any available bed'}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {plan.tasks.length} task{plan.tasks.length !== 1 ? 's' : ''} · activated {new Date(plan.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-border pt-3 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
            <Button size="sm" onClick={startNew}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> New Automation
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Wizard mode: 3 steps ──────────────────────────────────────────────────

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="shrink-0 space-y-3">
          <div className="flex items-center gap-2 pr-6">
            <Bot className="h-5 w-5 text-primary shrink-0" />
            <DialogTitle className="text-base font-semibold leading-none tracking-tight">
              New Automation
            </DialogTitle>
            <Badge variant="secondary" className="ml-auto text-[10px] shrink-0">
              Step {step} of 3 — {stepLabels[step]}
            </Badge>
          </div>

          {/* Progress */}
          <div className="flex gap-1">
            {[1, 2, 3].map(s => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>

          {/* Step-specific fixed content */}
          {step === 1 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Choose the crops you want the app to manage. It will schedule sowing, transplanting, and harvesting automatically.
              </p>
              <Input
                placeholder="Search crops…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="text-sm"
              />
            </div>
          )}

          {step === 2 && (
            <p className="text-xs text-muted-foreground">
              Choose which beds this automation will manage. The app will assign crops based on crop rotation.
            </p>
          )}

          {step === 3 && (
            <p className="text-xs text-muted-foreground">
              Review your selection. Once confirmed, the beds below will be app-managed and tasks will be added to your task list.
            </p>
          )}
        </div>

        {/* ── Scrollable body ──────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0 -mx-6 px-6">

          {/* Step 1: crop list */}
          {step === 1 && (
            <div className="space-y-4 py-1">
              {orderedGroupKeys.map(group => (
                <div key={group}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    {rotationLabel(group)}
                  </p>
                  <div className="space-y-1">
                    {plantsByGroup[group].map(plant => (
                      <label
                        key={plant.id}
                        className={`flex items-center gap-2.5 p-2 rounded-md cursor-pointer transition-colors ${
                          selectedCropIds.has(plant.id)
                            ? 'bg-primary/10 border border-primary/30'
                            : 'hover:bg-muted border border-transparent'
                        }`}
                      >
                        <Checkbox
                          checked={selectedCropIds.has(plant.id)}
                          onCheckedChange={() => toggleCrop(plant.id)}
                        />
                        <span className="text-base leading-none">{plant.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">{plant.name}</span>
                          {plant.sowIndoors && (
                            <span className="ml-2 text-[10px] text-muted-foreground">Sow indoors {plant.sowIndoors}</span>
                          )}
                          {!plant.sowIndoors && plant.sowOutdoors && (
                            <span className="ml-2 text-[10px] text-muted-foreground">Sow {plant.sowOutdoors}</span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {orderedGroupKeys.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No crops match your search.</p>
              )}
            </div>
          )}

          {/* Step 2: bed list */}
          {step === 2 && (
            <div className="py-1">
              {growingBeds.length === 0 ? (
                <div className="text-center py-12">
                  <Sprout className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium mb-1">No growing beds on your plot</p>
                  <p className="text-[11px] text-muted-foreground">Add raised beds or growing beds first.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {growingBeds.map((bed, idx) => {
                    const structure = getStructureById(bed.structureId);
                    const bedName = bed.name || `Bed ${idx + 1}`;
                    const isManaged = managedBedIds.has(bed.id);
                    const rotEntry = bed.rotationSlot ? GARDEN_ROTATION[bed.rotationSlot - 1] : null;
                    return (
                      <label
                        key={bed.id}
                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          isManaged ? 'bg-primary/10 border border-primary/30' : 'bg-card hover:bg-muted border border-border'
                        }`}
                      >
                        <Checkbox checked={isManaged} onCheckedChange={() => toggleBed(bed.id)} className="mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{bedName}</span>
                            {structure && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                                {structure.emoji} {structure.name}
                              </Badge>
                            )}
                            {rotEntry && (
                              <Badge className="text-[10px] h-4 px-1.5 bg-amber-100 text-amber-900 border-amber-200">
                                {rotEntry.emoji} {rotEntry.label}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {bed.widthCells}×{bed.heightCells} cells{bed.notes ? ` · ${bed.notes}` : ''}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 3: confirmation summary */}
          {step === 3 && preview && (
            <div className="space-y-4 py-1">

              {/* Crops summary */}
              <div className="p-3 rounded-lg border border-border bg-card space-y-2">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  🌱 Crops to manage
                  <Badge variant="secondary" className="text-[10px]">{selectedCropDetails.length}</Badge>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCropDetails.map(p => (
                    <span key={p.id} className="inline-flex items-center gap-1 text-[11px] bg-primary/10 text-primary rounded-full px-2 py-0.5">
                      {p.emoji} {p.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Beds summary */}
              <div className="p-3 rounded-lg border border-border bg-card space-y-2">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  🟫 Beds to be managed
                  {selectedBedDetails.length > 0
                    ? <Badge variant="secondary" className="text-[10px]">{selectedBedDetails.length}</Badge>
                    : <Badge variant="outline" className="text-[10px]">All available</Badge>
                  }
                </p>
                {selectedBedDetails.length > 0 ? (
                  <div className="space-y-1">
                    {selectedBedDetails.map(({ bed, name, structure }) => (
                      <div key={bed.id} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{structure?.emoji ?? '🟫'}</span>
                        <span className="font-medium text-foreground">{name}</span>
                        {bed.rotationSlot && (
                          <span className="text-muted-foreground">· {GARDEN_ROTATION[bed.rotationSlot - 1]?.label}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    No specific beds selected — the app will use available beds matched by crop rotation.
                  </p>
                )}
              </div>

              {/* Tasks summary */}
              <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  📋 Tasks that will be generated
                  <Badge variant="secondary" className="text-[10px]">{preview.tasks.length}</Badge>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Sowing, transplanting, and harvest reminders will appear in your{' '}
                  <strong>Task list → 🤖 Auto tab</strong>, each with a 🤖 badge.
                </p>
              </div>

              {/* Confirmation box */}
              <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCheck className="h-4 w-4 text-primary shrink-0" />
                  <p className="text-xs font-semibold text-foreground">What happens when you confirm</p>
                </div>
                <ul className="text-[11px] text-muted-foreground space-y-0.5 pl-6 list-disc">
                  <li>The selected beds become <strong>app-managed</strong></li>
                  <li>Tasks are added to your task list immediately</li>
                  <li>You can remove or add automations at any time</li>
                  <li>Tasks can be checked off as you complete them</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-border pt-3 flex items-center justify-between">

          {step === 1 && (
            <>
              {activePlans.length > 0 ? (
                <Button variant="ghost" size="sm" onClick={() => setMode('list')}>
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Back
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {selectedCropIds.size} crop{selectedCropIds.size !== 1 ? 's' : ''} selected
                </span>
                <Button size="sm" onClick={goToStep2} disabled={selectedCropIds.size === 0}>
                  Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Back
              </Button>
              <Button size="sm" onClick={goToStep3}>
                Review <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </>
          )}

          {step === 3 && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Back
              </Button>
              <Button size="sm" onClick={handleCommit} disabled={!preview}>
                <Bot className="h-3.5 w-3.5 mr-1.5" /> Confirm & Activate
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
