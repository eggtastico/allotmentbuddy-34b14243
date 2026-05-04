import { useAuth } from '@/hooks/use-auth';
import { useGardenPlans } from '@/hooks/useGardenPlans';
import { PlacedPlant, PlacedStructure, PlotSettings } from '@/types/garden';
import { type GardenPlanRow } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, FolderOpen, Trash2, Loader2, X, Download, Upload, HardDrive } from 'lucide-react';
import { useState, useRef } from 'react';
import { exportGardenJSON, parseGardenJSON, GardenExportData } from '@/utils/gardenExportImport';
import { toast } from 'sonner';

const MAX_SAVE_SLOTS = 5;

interface SaveLoadPanelProps {
  currentPlanId: string | null;
  currentName: string;
  settings: PlotSettings;
  plants: PlacedPlant[];
  beds: PlacedStructure[];
  onLoad: (plan: GardenPlanRow) => void;
  onNewPlan: () => void;
  onClose: () => void;
  onImport: (data: GardenExportData) => void;
}

export function SaveLoadPanel({ currentPlanId, currentName, settings, plants, beds, onLoad, onNewPlan, onClose, onImport }: SaveLoadPanelProps) {
  const { user } = useAuth();
  const { plans, save, delete: deletePlan, isSaving } = useGardenPlans();
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [slotName, setSlotName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showImportConfirm, setShowImportConfirm] = useState<GardenExportData | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState<{ slotIndex: number; plan: GardenPlanRow } | null>(null);

  const handleExport = () => {
    exportGardenJSON(currentName, settings, plants, beds);
    toast.success('Garden exported as JSON');
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text !== 'string') { toast.error('Could not read the file.'); return; }
      const result = parseGardenJSON(text);
      if (typeof result === 'string') { toast.error(result); return; }
      if (plants.length > 0 || beds.length > 0) {
        setShowImportConfirm(result);
      } else {
        onImport(result);
        toast.success(`Imported "${result.name}"`);
        onClose();
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSaveToSlot = async (slotIndex: number) => {
    const existingPlan = plans[slotIndex];
    const name = slotName.trim() || (existingPlan?.name ?? currentName);
    try {
      await save({ id: existingPlan?.id, name, settings, plants, beds });
      toast.success(`Saved to Slot ${slotIndex + 1} 🌿`);
      setEditingSlot(null);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleLoadSlot = (plan: GardenPlanRow) => {
    onLoad(plan);
    onClose();
  };

  const handleDeleteSlot = async (plan: GardenPlanRow) => {
    await deletePlan(plan.id).catch((err: Error) => toast.error(err.message));
  };

  const startEditSlot = (slotIndex: number) => {
    const plan = plans[slotIndex];
    setSlotName(plan?.name ?? currentName);
    setEditingSlot(slotIndex);
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 bg-foreground/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-xl w-full max-w-md animate-fade-in relative" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-foreground flex items-center gap-2">
              <HardDrive className="h-4 w-4" /> Save Slots
            </h2>
            <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>
          {user.email && (
            <p className="text-xs text-muted-foreground truncate">Signed in as {user.email}</p>
          )}
        </div>

        {/* Slots */}
        <div className="p-4 space-y-2">
          {Array.from({ length: MAX_SAVE_SLOTS }, (_, i) => {
            const plan = plans[i];
            const isCurrentPlan = plan?.id === currentPlanId;
            const isEditing = editingSlot === i;

            return (
              <div
                key={i}
                className={`rounded-lg border-2 p-3 transition-colors ${
                  isCurrentPlan
                    ? 'border-primary bg-primary/5'
                    : plan
                    ? 'border-border hover:border-primary/40'
                    : 'border-dashed border-border bg-muted/20'
                }`}
              >
                <div className="flex items-center gap-2">
                  {/* Slot number badge */}
                  <span className={`text-xs font-bold w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${isCurrentPlan ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {i + 1}
                  </span>

                  {plan ? (
                    isEditing ? (
                      /* Editing name */
                      <Input
                        autoFocus
                        value={slotName}
                        onChange={e => setSlotName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveToSlot(i); if (e.key === 'Escape') setEditingSlot(null); }}
                        className="flex-1 h-7 text-sm"
                      />
                    ) : (
                      /* Plan info */
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{plan.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {isCurrentPlan && <span className="text-primary font-medium mr-1">● Active · </span>}
                          {new Date(plan.updated_at!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    )
                  ) : (
                    <span className="flex-1 text-sm text-muted-foreground italic">Empty slot</span>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isEditing ? (
                      <>
                        <Button size="sm" className="h-7 text-xs px-2" disabled={isSaving} onClick={() => handleSaveToSlot(i)}>
                          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                          Save
                        </Button>
                        <button onClick={() => setEditingSlot(null)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : plan ? (
                      <>
                        {!isCurrentPlan && (
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => handleLoadSlot(plan)}>
                            <FolderOpen className="h-3 w-3 mr-1" /> Load
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => startEditSlot(i)}>
                          <Save className="h-3 w-3 mr-1" /> Save
                        </Button>
                        <button onClick={() => handleDeleteSlot(plan)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => startEditSlot(i)}>
                        <Save className="h-3 w-3 mr-1" /> Save here
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Export / Import */}
        <div className="px-4 pb-4 flex gap-2 border-t border-border pt-3">
          <Button variant="outline" size="sm" className="flex-1" onClick={handleExport}>
            <Download className="h-3 w-3 mr-1" /> Export JSON
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3 w-3 mr-1" /> Import JSON
          </Button>
          <input ref={fileInputRef} type="file" accept=".garden.json,.json" className="hidden" onChange={handleFileSelected} />
        </div>

        {/* Import confirmation overlay */}
        {showImportConfirm && (
          <div className="absolute inset-0 bg-card/95 rounded-xl flex flex-col items-center justify-center p-6 text-center">
            <h3 className="font-bold text-foreground mb-2">Replace current garden?</h3>
            <p className="text-sm text-muted-foreground mb-1">
              Importing <span className="font-medium text-foreground">"{showImportConfirm.name}"</span> will replace your current layout.
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              You have {plants.length} plant{plants.length !== 1 ? 's' : ''} and {beds.length} structure{beds.length !== 1 ? 's' : ''} placed.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowImportConfirm(null)}>Cancel</Button>
              <Button size="sm" onClick={() => { onImport(showImportConfirm); toast.success(`Imported "${showImportConfirm.name}"`); setShowImportConfirm(null); onClose(); }}>Import &amp; Replace</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
