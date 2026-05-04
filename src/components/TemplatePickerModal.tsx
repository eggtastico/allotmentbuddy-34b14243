import { gardenTemplates, GardenTemplate } from '@/data/gardenTemplates';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface TemplatePickerModalProps {
  onSelect: (template: GardenTemplate) => void;
  onClose: () => void;
}

export function TemplatePickerModal({ onSelect, onClose }: TemplatePickerModalProps) {
  return (
    <div className="fixed inset-0 bg-foreground/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-xl w-full max-w-lg animate-fade-in relative" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-bold text-foreground">Start from a Template</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {gardenTemplates.map((tpl) => (
            <button
              key={tpl.id}
              className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors"
              onClick={() => onSelect(tpl)}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{tpl.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">{tpl.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{tpl.description}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {tpl.settings.widthM}x{tpl.settings.heightM}{tpl.settings.unit === 'meters' ? 'm' : 'ft'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {tpl.plants.length} plants
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {tpl.structures.length} structures
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-border">
          <p className="text-[10px] text-muted-foreground text-center">
            Selecting a template will replace your current garden layout
          </p>
        </div>
      </div>
    </div>
  );
}
