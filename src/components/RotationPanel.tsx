import { PlacedPlant } from '@/types/garden';
import { analyzeRotation } from '@/utils/rotationOptimizer';
import { rotationGroupLabels, rotationGroupColors, getPlantById } from '@/data/plants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Shuffle, AlertTriangle, CheckCircle, TrendingUp, Calendar, ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import { useState } from 'react';

interface RotationPanelProps {
  plants: PlacedPlant[];
  onOptimize: () => void;
  onClose: () => void;
  yearPlans?: Record<number, PlacedPlant[]>;
  onDuplicateYear?: (fromYear: number, toYear: number) => void;
  currentYear?: number;
  onYearChange?: (year: number) => void;
}

export function RotationPanel({ plants, onOptimize, onClose, yearPlans, onDuplicateYear, currentYear, onYearChange }: RotationPanelProps) {
  const analysis = analyzeRotation(plants);
  const scoreColor = analysis.score >= 80 ? 'text-primary' : analysis.score >= 50 ? 'text-accent' : 'text-destructive';
  const [viewYear, setViewYear] = useState(currentYear || new Date().getFullYear());
  const years = yearPlans ? Object.keys(yearPlans).map(Number).sort() : [viewYear];
  if (!years.includes(viewYear)) years.push(viewYear);
  years.sort();

  // Cross-year conflict detection
  const crossYearConflicts: string[] = [];
  if (yearPlans && yearPlans[viewYear - 1]) {
    const prevPlants = yearPlans[viewYear - 1];
    const currentPlants = yearPlans[viewYear] || plants;
    currentPlants.forEach(cp => {
      const cd = getPlantById(cp.plantId);
      if (!cd) return;
      prevPlants.forEach(pp => {
        const pd = getPlantById(pp.plantId);
        if (!pd) return;
        // Same spot, same rotation group = bad
        if (Math.abs(cp.x - pp.x) <= 1 && Math.abs(cp.y - pp.y) <= 1 && cd.rotationGroup === pd.rotationGroup && cd.rotationGroup !== 'other') {
          const msg = `${cd.name} (${rotationGroupLabels[cd.rotationGroup]?.split('(')[0]?.trim()}) in same area as last year's ${pd.name} — rotate!`;
          if (!crossYearConflicts.includes(msg)) crossYearConflicts.push(msg);
        }
      });
    });
  }

  return (
    <div className="fixed inset-0 bg-foreground/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-xl w-full max-w-lg animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-bold text-foreground flex items-center gap-2">
            <Shuffle className="h-4 w-4 text-primary" /> Crop Rotation
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Multi-year navigation */}
          <div className="flex items-center justify-between bg-muted rounded-lg p-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewYear(v => v - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-bold text-foreground">{viewYear}</span>
              {viewYear === (currentYear || new Date().getFullYear()) && (
                <Badge variant="outline" className="text-[9px]">Current</Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {onDuplicateYear && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title={`Copy ${viewYear} plan to ${viewYear + 1}`}
                  onClick={() => onDuplicateYear(viewYear, viewYear + 1)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewYear(v => v + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Cross-year rotation conflicts */}
          {crossYearConflicts.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-destructive mb-1.5 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Year-over-year conflicts ({crossYearConflicts.length})
              </h3>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {crossYearConflicts.map((c, i) => (
                  <p key={i} className="text-xs text-destructive/80 bg-destructive/5 rounded px-2 py-1">{c}</p>
                ))}
              </div>
            </div>
          )}

          {/* Score */}
          <div className="text-center">
            <div className={`text-4xl font-bold ${scoreColor}`}>{analysis.score}</div>
            <p className="text-xs text-muted-foreground">Rotation Health Score</p>
          </div>

          {/* Group breakdown */}
          <div>
            <h3 className="text-xs font-medium text-foreground mb-2 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Groups in your garden
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(analysis.groupCounts).map(([group, count]) => (
                <Badge
                  key={group}
                  variant="outline"
                  className="text-xs"
                  style={{ borderColor: rotationGroupColors[group] + '66', color: rotationGroupColors[group] }}
                >
                  {rotationGroupLabels[group]?.split('(')[0]?.trim() || group} × {count}
                </Badge>
              ))}
            </div>
          </div>

          {/* Conflicts */}
          {analysis.conflicts.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-destructive mb-1.5 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Conflicts ({analysis.conflicts.length})
              </h3>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {analysis.conflicts.map((c, i) => (
                  <p key={i} className="text-xs text-destructive/80 bg-destructive/5 rounded px-2 py-1">{c.reason}</p>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {analysis.suggestions.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-accent mb-1.5">💡 Suggestions</h3>
              <div className="space-y-1">
                {analysis.suggestions.map((s, i) => (
                  <p key={i} className="text-xs text-muted-foreground bg-accent/5 rounded px-2 py-1">{s}</p>
                ))}
              </div>
            </div>
          )}

          {analysis.conflicts.length === 0 && analysis.suggestions.length === 0 && (
            <div className="text-center py-2">
              <CheckCircle className="h-6 w-6 text-primary mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Your garden rotation looks great!</p>
            </div>
          )}

          {/* Optimize button */}
          <Button className="w-full" onClick={() => { onOptimize(); onClose(); }}>
            <Shuffle className="h-4 w-4 mr-2" />
            Auto-Optimize Rotation
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">
            Groups plants by rotation family into zones. Herbs, flowers & perennials stay put.
          </p>

          {/* Year plan timeline */}
          {years.length > 1 && (
            <div className="border-t border-border pt-3">
              <h3 className="text-xs font-medium text-foreground mb-2 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Year timeline
              </h3>
              <div className="flex gap-1">
                {years.map(y => {
                  const yPlants = yearPlans?.[y] || (y === (currentYear || new Date().getFullYear()) ? plants : []);
                  const yGroups = [...new Set(yPlants.map(p => getPlantById(p.plantId)?.rotationGroup).filter(Boolean))];
                  return (
                    <button
                      key={y}
                      onClick={() => { setViewYear(y); onYearChange?.(y); }}
                      className={`flex-1 rounded-md p-1.5 text-center border transition-colors ${y === viewYear ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}
                    >
                      <div className="text-[10px] font-bold text-foreground">{y}</div>
                      <div className="flex flex-wrap gap-0.5 justify-center mt-1">
                        {yGroups.map(g => (
                          <span key={g} className="w-2 h-2 rounded-full" style={{ backgroundColor: rotationGroupColors[g!] }} title={g!} />
                        ))}
                      </div>
                      <div className="text-[8px] text-muted-foreground">{yPlants.length} plants</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
