import { PlacedPlant } from '@/types/garden';
import { analyzeRotation } from '@/utils/rotationOptimizer';
import { rotationGroupLabels, rotationGroupColors } from '@/data/plants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Shuffle, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';

interface RotationPanelProps {
  plants: PlacedPlant[];
  onOptimize: () => void;
  onClose: () => void;
}

export function RotationPanel({ plants, onOptimize, onClose }: RotationPanelProps) {
  const analysis = analyzeRotation(plants);
  const scoreColor = analysis.score >= 80 ? 'text-primary' : analysis.score >= 50 ? 'text-accent' : 'text-destructive';

  return (
    <div className="fixed inset-0 bg-foreground/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-xl w-full max-w-md animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-bold text-foreground flex items-center gap-2">
            <Shuffle className="h-4 w-4 text-primary" /> Crop Rotation
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-4 space-y-4">
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
        </div>
      </div>
    </div>
  );
}
