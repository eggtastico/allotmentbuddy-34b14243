import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { rotationGroupColors, rotationGroupLabels } from '@/data/plants';

interface BedData {
  label: string;
  family: string;
}

const FAMILIES = Object.keys(rotationGroupLabels);
const ROWS = 4;
const COLS = 3;

const defaultBeds = (): BedData[][] =>
  Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ label: '', family: '' }))
  );

interface Props {
  onClose: () => void;
}

export function PlotMapPanel({ onClose }: Props) {
  const [beds, setBeds] = useState<BedData[][]>(defaultBeds);
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editFamily, setEditFamily] = useState('');

  const startEdit = (r: number, c: number) => {
    setEditing({ r, c });
    setEditLabel(beds[r][c].label);
    setEditFamily(beds[r][c].family);
  };

  const saveEdit = () => {
    if (!editing) return;
    setBeds(prev => {
      const next = prev.map(row => [...row]);
      next[editing.r][editing.c] = { label: editLabel, family: editFamily };
      return next;
    });
    setEditing(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-auto p-5 animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">🗺️ Plot Map</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <p className="text-xs text-muted-foreground mb-4">Click a bed to label it and assign a crop family for rotation planning.</p>

        <div className="grid grid-cols-3 gap-2">
          {beds.map((row, r) =>
            row.map((bed, c) => {
              const color = bed.family ? rotationGroupColors[bed.family] : undefined;
              return (
                <button
                  key={`${r}-${c}`}
                  onClick={() => startEdit(r, c)}
                  className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center transition-all hover:scale-105 hover:shadow-md"
                  style={{
                    borderColor: color || 'hsl(var(--border))',
                    backgroundColor: color ? color + '18' : 'hsl(var(--muted))',
                  }}
                >
                  {bed.label ? (
                    <>
                      <span className="text-sm font-semibold text-foreground">{bed.label}</span>
                      {bed.family && (
                        <span className="text-[10px] mt-0.5 font-medium" style={{ color }}>
                          {rotationGroupLabels[bed.family]?.split(' ')[0]}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Bed {r * COLS + c + 1}</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Edit dialog */}
        {editing && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <h3 className="text-sm font-semibold text-foreground mb-2">Edit Bed {editing.r * COLS + editing.c + 1}</h3>
            <Input
              value={editLabel}
              onChange={e => setEditLabel(e.target.value)}
              placeholder="Bed label (e.g. Main Veg)"
              className="mb-2 h-8 text-sm"
            />
            <div className="flex flex-wrap gap-1 mb-3">
              {FAMILIES.map(f => (
                <button
                  key={f}
                  onClick={() => setEditFamily(f === editFamily ? '' : f)}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${editFamily === f ? 'text-white' : 'text-foreground/70'}`}
                  style={{
                    borderColor: rotationGroupColors[f],
                    backgroundColor: editFamily === f ? rotationGroupColors[f] : 'transparent',
                  }}
                >
                  {rotationGroupLabels[f]?.split(' ')[0]}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={saveEdit}>Save</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {FAMILIES.map(f => (
            <span key={f} className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: rotationGroupColors[f] + '22', color: rotationGroupColors[f] }}>
              {rotationGroupLabels[f]?.split('(')[0].trim()}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
