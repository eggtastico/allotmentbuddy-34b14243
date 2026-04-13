import { useAuth } from '@/hooks/useAuth';
import { useGardenPlans } from '@/hooks/useGardenPlans';
import { PlacedPlant, PlacedStructure, PlotSettings } from '@/types/garden';
import { type GardenPlanRow } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, FolderOpen, Trash2, Plus, Loader2, X } from 'lucide-react';
import { useState } from 'react';

interface SaveLoadPanelProps {
  currentPlanId: string | null;
  currentName: string;
  settings: PlotSettings;
  plants: PlacedPlant[];
  beds: PlacedStructure[];
  onLoad: (plan: GardenPlanRow) => void;
  onNewPlan: () => void;
  onClose: () => void;
}

export function SaveLoadPanel({ currentPlanId, currentName, settings, plants, beds, onLoad, onNewPlan, onClose }: SaveLoadPanelProps) {
  const { user } = useAuth();
  const { plans, save, delete: deletePlan, isSaving } = useGardenPlans();
  const [name, setName] = useState(currentName);

  if (!user) return null;

  return (
    <div className="fixed inset-0 bg-foreground/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-xl w-full max-w-md animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-bold text-foreground flex items-center gap-2"><FolderOpen className="h-4 w-4" /> My Gardens</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          {/* Save current */}
          <div className="flex gap-2">
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Garden name" className="flex-1 h-8 text-sm" />
            <Button size="sm" disabled={isSaving || !name.trim()} onClick={() => save({ id: currentPlanId ?? undefined, name, settings, plants, beds })}>
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
              Save
            </Button>
          </div>

          {/* Plan list */}
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {plans.map((plan: GardenPlanRow) => (
              <div key={plan.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted group">
                <button className="flex-1 text-left text-sm text-foreground" onClick={() => { onLoad(plan); onClose(); }}>
                  <span className="font-medium">{plan.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {new Date(plan.updated_at).toLocaleDateString()}
                  </span>
                </button>
                <button className="opacity-0 group-hover:opacity-100 p-1 text-destructive hover:bg-destructive/10 rounded" onClick={() => deletePlan(plan.id)}>
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            {plans.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No saved gardens yet</p>}
          </div>

          <Button variant="outline" size="sm" className="w-full" onClick={() => { onNewPlan(); onClose(); }}>
            <Plus className="h-3 w-3 mr-1" /> New Garden
          </Button>
        </div>
      </div>
    </div>
  );
}
