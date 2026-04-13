import { plants as allPlants } from '@/data/plants';
import { PlacedPlant } from '@/types/garden';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { getPlantById } from '@/data/plants';
import { MONTHS } from '@/components/constants/PlantingCalendar';
import { useFrostDates } from '@/hooks/useFrostDates';
import { getFrostSafetyColor, formatFrostDates } from '@/utils/frostDateCalculator';

interface LocationData {
  lat: number;
  lon: number;
  name?: string;
}

function parseMonthRange(range?: string): number[] {
  if (!range || range === 'Year-round') return range === 'Year-round' ? [0,1,2,3,4,5,6,7,8,9,10,11] : [];
  const months: number[] = [];
  const parts = range.split(',').map(s => s.trim());
  for (const part of parts) {
    const [start, end] = part.split('-').map(m => MONTHS.indexOf(m.trim()));
    if (start === -1) continue;
    if (end === undefined || end === -1) {
      months.push(start);
    } else {
      for (let i = start; i <= (end < start ? end + 12 : end); i++) months.push(i % 12);
    }
  }
  return months;
}

interface PlantingCalendarProps {
  placedPlants: PlacedPlant[];
  location?: LocationData | null;
  onClose: () => void;
}

export function PlantingCalendar({ placedPlants, location, onClose }: PlantingCalendarProps) {
  const frostDates = useFrostDates(location);
  const uniquePlantIds = [...new Set(placedPlants.map(p => p.plantId))];
  const gardenPlants = uniquePlantIds.map(id => getPlantById(id)).filter(Boolean);

  return (
    <div className="fixed inset-0 bg-foreground/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-xl w-full max-w-4xl max-h-[80vh] overflow-auto animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between z-10">
          <h2 className="font-bold text-foreground">📅 Planting Calendar</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        {gardenPlants.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Add plants to your garden to see the calendar
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Frost dates section */}
            {frostDates && (
              <div className="p-4 border-b border-border bg-muted/30">
                <div className="text-sm font-semibold text-foreground mb-2">❄️ Frost-Safe Planting Window</div>
                <div className="text-xs text-muted-foreground">
                  {formatFrostDates(frostDates)}
                </div>
              </div>
            )}
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2 sticky left-0 bg-card min-w-[120px]">Plant</th>
                  {frostDates && <th className="p-2 text-center min-w-[50px] text-muted-foreground font-medium" title="Frost hardiness">🌡️</th>}
                  {MONTHS.map(m => (
                    <th key={m} className="p-2 text-center min-w-[44px] text-muted-foreground font-medium">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gardenPlants.map(plant => {
                  if (!plant) return null;
                  const sowIndoorMonths = parseMonthRange(plant.sowIndoors);
                  const sowOutdoorMonths = parseMonthRange(plant.sowOutdoors);
                  const harvestMonths = parseMonthRange(plant.harvest);
                  const count = placedPlants.filter(p => p.plantId === plant.id).length;

                  const frostColor = frostDates ? getFrostSafetyColor(plant.frostHardiness, frostDates) : null;
                  const frostEmoji = plant.frostHardiness === 'hardy' ? '🟢' : plant.frostHardiness === 'half-hardy' ? '🟡' : plant.frostHardiness === 'tender' ? '🔴' : '⚪';

                  return (
                    <tr key={plant.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-2 sticky left-0 bg-card">
                        <div className="flex items-center gap-1.5">
                          <span>{plant.emoji}</span>
                          <span className="font-medium text-foreground">{plant.name}</span>
                          <Badge variant="outline" className="text-[10px] px-1 py-0">{count}</Badge>
                        </div>
                      </td>
                      {frostDates && (
                        <td className="p-2 text-center text-base" title={plant.frostHardiness || 'Unknown'}>
                          {frostEmoji}
                        </td>
                      )}
                      {MONTHS.map((_, i) => {
                        const isSowIndoor = sowIndoorMonths.includes(i);
                        const isSowOutdoor = sowOutdoorMonths.includes(i);
                        const isHarvest = harvestMonths.includes(i);
                        return (
                          <td key={i} className="p-1 text-center">
                            {isSowIndoor && <div className="h-3 rounded-sm bg-garden-water/60 mb-0.5" title="Sow indoors" />}
                            {isSowOutdoor && <div className="h-3 rounded-sm bg-primary/60 mb-0.5" title="Sow outdoors" />}
                            {isHarvest && <div className="h-3 rounded-sm bg-accent/60" title="Harvest" />}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="p-3 border-t border-border space-y-2 text-xs text-muted-foreground">
              <div className="flex gap-4 flex-wrap">
                <span className="flex items-center gap-1"><span className="h-3 w-5 rounded-sm bg-garden-water/60 inline-block" /> Sow indoors</span>
                <span className="flex items-center gap-1"><span className="h-3 w-5 rounded-sm bg-primary/60 inline-block" /> Sow outdoors</span>
                <span className="flex items-center gap-1"><span className="h-3 w-5 rounded-sm bg-accent/60 inline-block" /> Harvest</span>
              </div>
              {frostDates && (
                <div className="flex gap-4 flex-wrap">
                  <span className="flex items-center gap-1">🟢 Hardy (plant anytime)</span>
                  <span className="flex items-center gap-1">🟡 Half-hardy (after last frost)</span>
                  <span className="flex items-center gap-1">🔴 Tender (wait for warm soil)</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
