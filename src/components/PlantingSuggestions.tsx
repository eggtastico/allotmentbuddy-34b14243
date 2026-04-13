import { useState, useEffect } from 'react';
import { X, Lightbulb, Loader2, Package, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { plants } from '@/data/plants';
import { monthNames, seasonMap } from '@/components/constants/PlantingSuggestions';

interface SeedItem {
  id: string;
  plant_name: string;
  variety: string;
  quantity: number;
  ai_extracted_data: Record<string, unknown>;
}

interface Suggestion {
  seed: SeedItem;
  plant: typeof plants[0];
  canSow: boolean;
  canHarvest: boolean;
}

interface PlantingSuggestionsProps {
  onClose: () => void;
}

function matchesSowingMonth(plantData: typeof plants[0], month: number): boolean {
  const seasons = seasonMap[month] || [];
  return plantData.sowingSeason?.some(s => seasons.includes(s)) || false;
}

function matchesHarvestMonth(plantData: typeof plants[0], month: number): boolean {
  if (!plantData.harvest) return false;
  const monthAbbrs = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const abbr = monthAbbrs[month];
  return plantData.harvest.includes(abbr);
}

export function PlantingSuggestions({ onClose }: PlantingSuggestionsProps) {
  const { user } = useAuth();
  const [seeds, setSeeds] = useState<SeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentMonth = now.getMonth();
  const nextMonth = (currentMonth + 1) % 12;

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase.from('seed_inventory').select('id, plant_name, variety, quantity, ai_extracted_data')
      .then(({ data }) => { if (data) setSeeds(data as SeedItem[]); setLoading(false); });
  }, [user]);

  // Match seeds to plant library
  const getSuggestions = (month: number): Suggestion[] => {
    return seeds.map(seed => {
      const match = plants.find(p =>
        p.name.toLowerCase() === seed.plant_name.toLowerCase() ||
        p.name.toLowerCase().includes(seed.plant_name.toLowerCase()) ||
        seed.plant_name.toLowerCase().includes(p.name.toLowerCase())
      );
      if (!match) return null;
      const canSow = matchesSowingMonth(match, month);
      const canHarvest = matchesHarvestMonth(match, month);
      if (!canSow && !canHarvest) return null;
      return { seed, plant: match, canSow, canHarvest };
    }).filter((s): s is Suggestion => s !== null);
  };

  const thisMonthSuggestions = getSuggestions(currentMonth);
  const nextMonthSuggestions = getSuggestions(nextMonth);

  // Also show general suggestions for plants not in inventory
  const generalSow = plants.filter(p => matchesSowingMonth(p, currentMonth) && p.category === 'vegetable').slice(0, 5);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" /> Planting Suggestions
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto">
            {/* This month from inventory */}
            <div>
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4" /> {monthNames[currentMonth]} — From Your Inventory
              </h3>
              {thisMonthSuggestions.length === 0 ? (
                <p className="text-xs text-muted-foreground ml-6">
                  {seeds.length === 0 ? 'Add seeds to your inventory to get personalized suggestions.' : 'No seeds from your inventory match this month.'}
                </p>
              ) : (
                <div className="space-y-1.5 ml-6">
                  {thisMonthSuggestions.map((s: Suggestion) => (
                    <div key={s.seed.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                      <span className="text-lg">{s.plant.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-foreground">{s.seed.plant_name}</span>
                          {s.seed.variety && <span className="text-[10px] px-1 py-0.5 rounded bg-primary/10 text-primary">{s.seed.variety}</span>}
                          <span className="text-[10px] text-muted-foreground">×{s.seed.quantity}</span>
                        </div>
                        <div className="flex gap-1 mt-0.5">
                          {s.canSow && <Badge variant="outline" className="text-[10px] h-4 bg-green-500/10 text-green-700 border-green-500/30">🌱 Sow now</Badge>}
                          {s.canHarvest && <Badge variant="outline" className="text-[10px] h-4 bg-amber-500/10 text-amber-700 border-amber-500/30">🌾 Harvest</Badge>}
                        </div>
                      </div>
                      <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Next month preview */}
            <div>
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4" /> Coming Up: {monthNames[nextMonth]}
              </h3>
              {nextMonthSuggestions.length === 0 ? (
                <p className="text-xs text-muted-foreground ml-6">Nothing from your inventory for next month.</p>
              ) : (
                <div className="space-y-1 ml-6">
                  {nextMonthSuggestions.map((s: Suggestion) => (
                    <div key={s.seed.id} className="flex items-center gap-2 p-1.5 rounded-md text-xs text-muted-foreground">
                      <span>{s.plant.emoji}</span>
                      <span>{s.seed.plant_name}</span>
                      {s.canSow && <span className="text-green-600">• sow</span>}
                      {s.canHarvest && <span className="text-amber-600">• harvest</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* General suggestions */}
            <div>
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-amber-500" /> General: Sow This Month
              </h3>
              <div className="flex flex-wrap gap-1 ml-6">
                {generalSow.map(p => (
                  <Badge key={p.id} variant="outline" className="text-xs">
                    {p.emoji} {p.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
