import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { plants } from '@/data/plants';
import { CalendarRange, ChevronLeft, ChevronRight, Sprout, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MonthlyPlannerProps {
  onClose: () => void;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_ABBRS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthInRange(rangeStr: string | undefined, monthIndex: number): boolean {
  if (!rangeStr) return false;
  const abbr = MONTH_ABBRS[monthIndex];
  const parts = rangeStr.split(',').map(s => s.trim());
  for (const part of parts) {
    const [start, end] = part.split('-').map(s => s.trim());
    if (!end) { if (start === abbr) return true; continue; }
    const si = MONTH_ABBRS.indexOf(start);
    const ei = MONTH_ABBRS.indexOf(end);
    const ci = MONTH_ABBRS.indexOf(abbr);
    if (si < 0 || ei < 0 || ci < 0) continue;
    if (si <= ei) { if (ci >= si && ci <= ei) return true; }
    else { if (ci >= si || ci <= ei) return true; }
  }
  return false;
}

const GENERAL_JOBS: Record<number, string[]> = {
  0: ['Plan crop rotation', 'Order seeds', 'Chit early potatoes', 'Prune fruit trees'],
  1: ['Sow tomatoes & peppers indoors', 'Prepare beds with compost', 'Plant garlic (if not done in autumn)'],
  2: ['Sow broad beans & peas', 'Plant onion sets', 'Start hardening off seedlings', 'Mulch beds'],
  3: ['Plant out first early potatoes', 'Sow carrots & beetroot', 'Net brassicas against pigeons'],
  4: ['Plant out tomatoes after last frost', 'Sow French beans', 'Earth up potatoes', 'Hoe weeds regularly'],
  5: ['Feed tomatoes weekly (high potash)', 'Pinch out tomato side shoots', 'Sow successional salads'],
  6: ['Water consistently in dry spells', 'Harvest early potatoes', 'Summer prune fruit trees'],
  7: ['Sow spring cabbage', 'Harvest onions', 'Continue feeding fruiting crops'],
  8: ['Plant garlic for next year', 'Harvest squash before frost', 'Green manure on bare beds'],
  9: ['Clear spent crops', 'Plant bare-root fruit trees', 'Collect and compost fallen leaves'],
  10: ['Dig heavy soils for frost to break down', 'Protect brassicas with netting', 'Check stored crops'],
  11: ['Plan next year\'s plot', 'Order seed catalogues', 'Maintenance on tools and structures'],
};

export function MonthlyPlanner({ onClose }: MonthlyPlannerProps) {
  const currentMonth = new Date().getMonth();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const monthData = useMemo(() => {
    const sowIndoors = plants.filter(p => monthInRange(p.sowIndoors, selectedMonth));
    const sowOutdoors = plants.filter(p => monthInRange(p.sowOutdoors, selectedMonth));
    const harvest = plants.filter(p => monthInRange(p.harvest, selectedMonth));
    return { sowIndoors, sowOutdoors, harvest };
  }, [selectedMonth]);

  const jobs = GENERAL_JOBS[selectedMonth] || [];

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-primary" /> Monthly Garden Planner
          </DialogTitle>
        </DialogHeader>

        {/* Month selector */}
        <div className="flex items-center gap-2 justify-center">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedMonth((selectedMonth + 11) % 12)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex gap-1 flex-wrap justify-center">
            {MONTHS.map((m, i) => (
              <button
                key={m}
                onClick={() => setSelectedMonth(i)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  i === selectedMonth ? 'bg-primary text-primary-foreground' : i === currentMonth ? 'bg-primary/20 text-primary' : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                {MONTH_ABBRS[i]}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedMonth((selectedMonth + 1) % 12)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-4 pr-2">
            {/* General jobs */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">🔧 General Jobs for {MONTHS[selectedMonth]}</h3>
              <ul className="space-y-1 ml-4">
                {jobs.map((job, i) => (
                  <li key={i} className="text-xs text-muted-foreground list-disc">{job}</li>
                ))}
              </ul>
            </div>

            {/* Sow indoors */}
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-2">
                <Sprout className="h-4 w-4 text-green-600" /> Sow Indoors
              </h3>
              {monthData.sowIndoors.length === 0 ? (
                <p className="text-xs text-muted-foreground italic ml-6">Nothing to sow indoors this month.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 ml-6">
                  {monthData.sowIndoors.map(p => (
                    <Badge key={p.id} variant="outline" className="text-xs bg-green-500/10 text-green-700 border-green-500/30">
                      {p.emoji} {p.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Sow outdoors */}
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-2">
                <Sprout className="h-4 w-4 text-emerald-600" /> Sow / Plant Outdoors
              </h3>
              {monthData.sowOutdoors.length === 0 ? (
                <p className="text-xs text-muted-foreground italic ml-6">Nothing to sow outdoors this month.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 ml-6">
                  {monthData.sowOutdoors.map(p => (
                    <Badge key={p.id} variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                      {p.emoji} {p.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Harvest */}
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-2">
                <Scissors className="h-4 w-4 text-amber-600" /> Harvest
              </h3>
              {monthData.harvest.length === 0 ? (
                <p className="text-xs text-muted-foreground italic ml-6">Nothing to harvest this month.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 ml-6">
                  {monthData.harvest.map(p => (
                    <Badge key={p.id} variant="outline" className="text-xs bg-amber-500/10 text-amber-700 border-amber-500/30">
                      {p.emoji} {p.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
