import React, { useMemo } from 'react';
import { PlacedPlant } from '@/types/garden';
import { Slider } from '@/components/ui/slider';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { plants as allPlants, getPlantById } from '@/data/plants';
import { getSowingStatus } from '@/utils/seasonalSowing';
import { cn } from '@/lib/utils';

const MONTH_ABBREVS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

interface SuccessionSliderProps {
  viewMonth: number;
  onChange: (month: number) => void;
  placedPlants: PlacedPlant[];
  visible: boolean;
  onToggle: () => void;
}

/**
 * Sowing suggestions for a given month, shown in the succession slider.
 */
function SowingSuggestions({ month, placedPlants }: { month: number; placedPlants: PlacedPlant[] }) {
  const suggestions = useMemo(() => {
    const placed = new Set(placedPlants.map(p => p.plantId));
    const sowable: { name: string; status: string }[] = [];

    for (const plant of allPlants) {
      if (placed.has(plant.id)) continue; // Already planted

      const sowStatus = getSowingStatus(plant, month);
      if (sowStatus.canSowNow) {
        let status = '';
        if (sowStatus.sowIndoorsNow && sowStatus.sowOutdoorsNow) {
          status = 'Sow now';
        } else if (sowStatus.sowIndoorsNow) {
          status = 'Sow indoors';
        } else if (sowStatus.sowOutdoorsNow) {
          status = 'Sow outdoors';
        }
        if (status) {
          sowable.push({ name: plant.name, status });
        }
      }
    }

    // Return up to 6 suggestions
    return sowable.slice(0, 6);
  }, [month, placedPlants]);

  if (suggestions.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic">
        No plants to sow this month.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-muted-foreground uppercase">
        What to sow in {MONTH_NAMES[month]}
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map(({ name, status }) => (
          <div
            key={name}
            className="flex items-center gap-1 px-2 py-1 rounded-sm bg-muted text-xs"
          >
            <span>🌱</span>
            <span className="font-medium">{name}</span>
            <span className="text-muted-foreground">({status})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SuccessionSlider({
  viewMonth,
  onChange,
  placedPlants,
  visible,
  onToggle,
}: SuccessionSliderProps) {
  return (
    <div className="border-t border-border bg-card">
      {/* Toggle bar — always visible */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <span>🗓️ Season View</span>
          <span className="text-primary">{MONTH_NAMES[viewMonth]}</span>
        </div>
        {visible ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Collapsible body */}
      {visible && (
        <div className="px-4 py-3 space-y-4 border-t border-border/50">
          {/* Slider */}
          <div className="space-y-2">
            <Slider
              min={0}
              max={11}
              step={1}
              value={[viewMonth]}
              onValueChange={([v]) => onChange(v)}
              className="w-full"
            />
          </div>

          {/* Month pill buttons for quick jump */}
          <div className="flex gap-1 flex-wrap">
            {MONTH_ABBREVS.map((abbr, i) => (
              <button
                key={i}
                onClick={() => onChange(i)}
                className={cn(
                  'text-xs px-2 py-1 rounded-sm transition-colors',
                  i === viewMonth
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {abbr}
              </button>
            ))}
          </div>

          {/* Sowing suggestions */}
          <SowingSuggestions month={viewMonth} placedPlants={placedPlants} />
        </div>
      )}
    </div>
  );
}
