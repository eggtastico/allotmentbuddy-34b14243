import { useState } from 'react';
import { plants } from '@/data/plants';
import { structures } from '@/data/structures';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Leaf, Building2, Filter } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import type { Plant } from '@/types/garden';

const categoryOrder = ['vegetable', 'fruit', 'herb', 'flower'] as const;
const categoryLabels = { vegetable: '🥦 Vegetables', fruit: '🍓 Fruits', herb: '🌿 Herbs', flower: '🌼 Flowers' };

const difficultyColors = { easy: 'bg-green-500/15 text-green-700', moderate: 'bg-amber-500/15 text-amber-700', challenging: 'bg-red-500/15 text-red-700' };
const hardinessLabels = { hardy: '❄️ Hardy', 'half-hardy': '🌤️ Half-hardy', tender: '☀️ Tender' };
const sunLabels = { 'full-sun': '☀️ Full sun', 'partial-shade': '⛅ Partial shade', 'full-shade': '🌑 Full shade', any: '🌤️ Any' };

interface PlantSidebarProps {
  onDragStart: (plantId: string) => void;
}

function PlantHoverInfo({ plant }: { plant: Plant }) {
  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{plant.emoji}</span>
        <div>
          <p className="font-semibold text-sm text-foreground">{plant.name}</p>
          {plant.family && <p className="text-muted-foreground italic">{plant.family}</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {plant.difficulty && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${difficultyColors[plant.difficulty]}`}>
            {plant.difficulty}
          </span>
        )}
        {plant.frostHardiness && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
            {hardinessLabels[plant.frostHardiness]}
          </span>
        )}
        {plant.sunPreference && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
            {sunLabels[plant.sunPreference]}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-muted-foreground">
        {plant.sowIndoors && <div><span className="font-medium text-foreground">Sow indoors:</span> {plant.sowIndoors}</div>}
        {plant.sowOutdoors && <div><span className="font-medium text-foreground">Sow outdoors:</span> {plant.sowOutdoors}</div>}
        {plant.harvest && <div><span className="font-medium text-foreground">Harvest:</span> {plant.harvest}</div>}
        <div><span className="font-medium text-foreground">Spacing:</span> {plant.spacingCm}cm</div>
        {plant.daysToHarvest && <div><span className="font-medium text-foreground">Days:</span> {plant.daysToHarvest}</div>}
        {plant.yieldPerPlant && <div><span className="font-medium text-foreground">Yield:</span> {plant.yieldPerPlant}</div>}
      </div>

      {plant.companions.length > 0 && (
        <div>
          <span className="font-medium text-green-600">✅ Good with:</span>{' '}
          <span className="text-muted-foreground">{plant.companions.join(', ')}</span>
        </div>
      )}
      {plant.enemies.length > 0 && (
        <div>
          <span className="font-medium text-red-500">❌ Avoid:</span>{' '}
          <span className="text-muted-foreground">{plant.enemies.join(', ')}</span>
        </div>
      )}

      {plant.tips && (
        <p className="text-muted-foreground border-t border-border pt-1.5 mt-1">💡 {plant.tips}</p>
      )}
    </div>
  );
}

export function PlantSidebar({ onDragStart }: PlantSidebarProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [tab, setTab] = useState<'plants' | 'structures'>('plants');
  const [showFilters, setShowFilters] = useState(false);
  const [difficultyFilter, setDifficultyFilter] = useState<string | null>(null);
  const [seasonFilter, setSeasonFilter] = useState<string | null>(null);
  const [sunFilter, setSunFilter] = useState<string | null>(null);
  const [varietyFilter, setVarietyFilter] = useState<string | null>(null);

  // Get unique varieties for current category
  const availableVarieties = [...new Set(
    plants.filter(p => p.variety && (!activeCategory || p.category === activeCategory))
      .map(p => p.variety!)
  )].sort();

  const filtered = plants.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !activeCategory || p.category === activeCategory;
    const matchesDifficulty = !difficultyFilter || p.difficulty === difficultyFilter;
    const matchesSeason = !seasonFilter || (p.sowingSeason && p.sowingSeason.includes(seasonFilter));
    const matchesSun = !sunFilter || p.sunPreference === sunFilter;
    const matchesVariety = !varietyFilter || p.variety === varietyFilter;
    return matchesSearch && matchesCategory && matchesDifficulty && matchesSeason && matchesSun && matchesVariety;
  });

  const filteredStructures = structures.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = categoryOrder.reduce((acc, cat) => {
    const items = filtered.filter(p => p.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {} as Record<string, typeof plants>);

  const activeFilterCount = [difficultyFilter, seasonFilter, sunFilter, varietyFilter].filter(Boolean).length;

  return (
    <div className="w-64 border-r border-border bg-card flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <h2 className="font-semibold text-sm mb-2 text-foreground">🌱 Plant Library <span className="text-muted-foreground font-normal">({plants.length})</span></h2>
        {/* Tabs */}
        <div className="flex gap-1 mb-2">
          <button
            onClick={() => setTab('plants')}
            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors ${tab === 'plants' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            <Leaf className="h-3 w-3" /> Plants
          </button>
          <button
            onClick={() => setTab('structures')}
            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors ${tab === 'structures' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            <Building2 className="h-3 w-3" /> Structures
          </button>
          {tab === 'plants' && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`ml-auto flex items-center gap-1 text-xs px-2 py-1.5 rounded-md font-medium transition-colors ${showFilters || activeFilterCount > 0 ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
              title="Filters"
            >
              <Filter className="h-3 w-3" />
              {activeFilterCount > 0 && <span className="text-[9px]">{activeFilterCount}</span>}
            </button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'plants' ? 'Search plants...' : 'Search structures...'}
            className="pl-7 h-8 text-sm"
          />
        </div>
        {tab === 'plants' && (
          <div className="flex flex-wrap gap-1 mt-2">
            {categoryOrder.map(cat => (
              <Badge
                key={cat}
                variant={activeCategory === cat ? "default" : "outline"}
                className="cursor-pointer text-xs px-2 py-0.5"
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              >
                {categoryLabels[cat].split(' ')[0]}
              </Badge>
            ))}
          </div>
        )}
        {/* Advanced filters */}
        {tab === 'plants' && showFilters && (
          <div className="mt-2 space-y-1.5 p-2 bg-muted/50 rounded-md">
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1">Difficulty</p>
              <div className="flex gap-1">
                {(['easy', 'moderate', 'challenging'] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setDifficultyFilter(difficultyFilter === d ? null : d)}
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium transition-colors ${difficultyFilter === d ? difficultyColors[d] + ' ring-1 ring-current' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1">Sowing season</p>
              <div className="flex gap-1">
                {['spring', 'summer', 'autumn', 'winter'].map(s => (
                  <button
                    key={s}
                    onClick={() => setSeasonFilter(seasonFilter === s ? null : s)}
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium transition-colors ${seasonFilter === s ? 'bg-primary/15 text-primary ring-1 ring-primary/30' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1">Sun</p>
              <div className="flex gap-1 flex-wrap">
                {(['full-sun', 'partial-shade', 'any'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setSunFilter(sunFilter === s ? null : s)}
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium transition-colors ${sunFilter === s ? 'bg-amber-500/15 text-amber-700 ring-1 ring-amber-400/30' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                  >
                    {sunLabels[s]}
                  </button>
                ))}
              </div>
            </div>
            {activeFilterCount > 0 && (
              <button
                onClick={() => { setDifficultyFilter(null); setSeasonFilter(null); setSunFilter(null); }}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-3">
        {tab === 'plants' ? (
          <>
            {filtered.length > 0 && filtered.length !== plants.length && (
              <p className="text-[10px] text-muted-foreground px-1">{filtered.length} plants</p>
            )}
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <p className="text-xs font-medium text-muted-foreground px-1 mb-1">
                  {categoryLabels[cat as keyof typeof categoryLabels]} ({items.length})
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {items.map(plant => (
                    <HoverCard key={plant.id} openDelay={300} closeDelay={100}>
                      <HoverCardTrigger asChild>
                        <div
                          draggable
                          onDragStart={e => {
                            e.dataTransfer.setData('plantId', plant.id);
                            onDragStart(plant.id);
                          }}
                          className="flex items-center gap-1.5 p-1.5 rounded-md bg-background hover:bg-muted cursor-grab active:cursor-grabbing transition-colors text-xs border border-transparent hover:border-border group"
                          title={plant.name}
                        >
                          <span className="text-base group-hover:animate-plant-bounce">{plant.emoji}</span>
                          <span className="truncate text-foreground">{plant.name}</span>
                        </div>
                      </HoverCardTrigger>
                      <HoverCardContent side="right" align="start" className="w-72 p-3">
                        <PlantHoverInfo plant={plant} />
                      </HoverCardContent>
                    </HoverCard>
                  ))}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">No plants found</p>
            )}
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground px-1">Drag structures onto your plot. Green-tagged ones allow plants inside.</p>
            <div className="space-y-1">
              {filteredStructures.map(structure => (
                <div
                  key={structure.id}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData('structureId', structure.id);
                  }}
                  className="flex items-center gap-2 p-2 rounded-md bg-background hover:bg-muted cursor-grab active:cursor-grabbing transition-colors text-xs border border-transparent hover:border-border group"
                  title={structure.description}
                >
                  <span className="text-lg">{structure.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground">{structure.name}</span>
                      {structure.canGrowInside && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-primary/15 text-primary font-medium">Grow</span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{structure.widthCells}×{structure.heightCells} cells</span>
                  </div>
                </div>
              ))}
            </div>
            {filteredStructures.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">No structures found</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
