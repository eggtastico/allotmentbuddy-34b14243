import { useState, useMemo, useRef } from 'react';
import { plants } from '@/data/plants';
import { structures } from '@/data/structures';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Leaf, Building2, Filter, ChevronDown, ChevronRight, Star, GripVertical, Minus, Plus } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { Plant } from '@/types/garden';
import { suggestBedSizeForPlant } from '@/utils/bedPlantSuggestions';
import { getSuccessionSuggestions } from '@/utils/successionPlanting';
import { useFavouritePlants } from '@/hooks/useFavouritePlants';
import { getPlantById } from '@/data/plants';

const categoryOrder = ['vegetable', 'fruit', 'herb', 'flower'] as const;
const categoryLabels = { vegetable: '🥦 Vegetables', fruit: '🍓 Fruits', herb: '🌿 Herbs', flower: '🌼 Flowers' };

const difficultyColors = { easy: 'bg-primary/15 text-primary', moderate: 'bg-warning/15 text-warning', challenging: 'bg-accent/15 text-accent' };
const hardinessLabels = { hardy: '❄️ Hardy', 'half-hardy': '🌤️ Half-hardy', tender: '☀️ Tender' };
const sunLabels = { 'full-sun': '☀️ Full sun', 'partial-shade': '⛅ Partial shade', 'full-shade': '🌑 Full shade', any: '🌤️ Any' };

type GroupMode = 'category' | 'family';

const familyEmojis: Record<string, string> = {
  Solanaceae: '🍅', Apiaceae: '🥕', Fabaceae: '🫘', Cucurbitaceae: '🥒',
  Brassicaceae: '🥦', Amaryllidaceae: '🧅', Asteraceae: '🌻', Lamiaceae: '🌿',
  Rosaceae: '🍓', Amaranthaceae: '🍃', Grossulariaceae: '🫐', Ericaceae: '🫐',
  Poaceae: '🌽', Asparagaceae: '🌿', Polygonaceae: '🍃', Boraginaceae: '💙',
  Tropaeolaceae: '🌸', Convolvulaceae: '🍠', Limnanthaceae: '🌼', Plantaginaceae: '🌺',
  Moraceae: '🫐', Vitaceae: '🍇', Lauraceae: '🌿',
};

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
          <span className="font-medium text-primary">✅ Good with:</span>{' '}
          <span className="text-muted-foreground">{plant.companions.join(', ')}</span>
        </div>
      )}
      {plant.enemies.length > 0 && (
        <div>
          <span className="font-medium text-accent">❌ Avoid:</span>{' '}
          <span className="text-muted-foreground">{plant.enemies.join(', ')}</span>
        </div>
      )}

      {plant.tips && (
        <p className="text-muted-foreground border-t border-border pt-1.5 mt-1">💡 {plant.tips}</p>
      )}

      <div className="border-t border-border pt-1.5 mt-1">
        <p className="font-medium text-foreground text-[10px] mb-1">📐 Suggested bed sizes:</p>
        <div className="flex flex-wrap gap-1">
          {suggestBedSizeForPlant(plant).slice(0, 3).map(s => (
            <span key={s.label} className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
              {s.label}: {s.description}
            </span>
          ))}
        </div>
      </div>

      {plant.harvest && getSuccessionSuggestions(plant.id).length > 0 && (
        <div className="border-t border-border pt-1.5 mt-1">
          <p className="font-medium text-foreground text-[10px] mb-1">🔄 Follow with:</p>
          <div className="flex flex-wrap gap-1">
            {getSuccessionSuggestions(plant.id).slice(0, 3).map(s => (
              <span key={s.plant.id} className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                {s.plant.emoji} {s.plant.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlantItem({ plant, onDragStart, isFavourite, onToggleFavourite }: { plant: Plant; onDragStart: (id: string) => void; isFavourite: boolean; onToggleFavourite: (id: string) => void }) {
  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div
          draggable
          onDragStart={e => {
            e.dataTransfer.setData('plantId', plant.id);
            onDragStart(plant.id);
          }}
          onClick={() => onDragStart(plant.id)}
          className="flex items-center gap-1.5 p-2 rounded-2xl bg-background hover:bg-muted cursor-pointer active:cursor-grabbing transition-colors text-xs border border-transparent hover:border-border group min-h-[36px]"
          title={`${plant.name} — tap to select, then tap grid to place`}
        >
          <span className="text-base group-hover:animate-plant-bounce">{plant.emoji}</span>
          <span className="truncate text-foreground font-medium flex-1">{plant.name}</span>
          <button
            onClick={e => { e.stopPropagation(); e.preventDefault(); onToggleFavourite(plant.id); }}
            onMouseDown={e => e.stopPropagation()}
            className={`shrink-0 h-5 w-5 rounded-full flex items-center justify-center transition-colors ${
              isFavourite ? 'text-amber-500' : 'text-muted-foreground/30 opacity-0 group-hover:opacity-100'
            }`}
            title={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
          >
            <Star className={`h-3 w-3 ${isFavourite ? 'fill-amber-500' : ''}`} />
          </button>
        </div>
      </HoverCardTrigger>
      <HoverCardContent side="right" align="start" className="w-72 p-3 rounded-2xl">
        <PlantHoverInfo plant={plant} />
      </HoverCardContent>
    </HoverCard>
  );
}

function FavouritesTab({ onDragStart, favouriteIds, reorder, toggleFavourite, getQuantity, setQuantity }: {
  onDragStart: (id: string) => void;
  favouriteIds: string[];
  reorder: (from: number, to: number) => void;
  toggleFavourite: (id: string) => void;
  getQuantity: (plantId: string) => number;
  setQuantity: (plantId: string, qty: number) => void;
}) {
  const dragItemRef = useRef<number | null>(null);
  const dragOverItemRef = useRef<number | null>(null);

  const handleDragStart = (index: number) => {
    dragItemRef.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItemRef.current = index;
  };

  const handleDragEnd = () => {
    if (dragItemRef.current !== null && dragOverItemRef.current !== null && dragItemRef.current !== dragOverItemRef.current) {
      reorder(dragItemRef.current, dragOverItemRef.current);
    }
    dragItemRef.current = null;
    dragOverItemRef.current = null;
  };

  if (favouriteIds.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <Star className="h-8 w-8 text-amber-500/30 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground font-medium">No favourites yet</p>
        <p className="text-[10px] text-muted-foreground mt-1">Click the ⭐ star on any plant to add it here. Drag to reorder your priority list.</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-muted-foreground px-1 font-semibold mb-1">
        Drag to reorder priority · Set qty (0 = auto)
      </p>
      {favouriteIds.map((plantId, index) => {
        const plant = getPlantById(plantId);
        if (!plant) return null;
        const qty = getQuantity(plantId);
        return (
          <div
            key={plantId}
            draggable
            onDragStart={e => {
              handleDragStart(index);
              e.dataTransfer.setData('plantId', plant.id);
              e.dataTransfer.effectAllowed = 'move';
              onDragStart(plant.id);
            }}
            onDragEnter={() => handleDragEnter(index)}
            onDragEnd={handleDragEnd}
            onDragOver={e => e.preventDefault()}
            className="flex items-center gap-1 p-1.5 rounded-2xl bg-background hover:bg-muted cursor-grab active:cursor-grabbing transition-colors text-xs border border-transparent hover:border-border group min-h-[36px]"
          >
            <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            <span className="text-[10px] font-bold text-muted-foreground w-4 text-center shrink-0">{index + 1}</span>
            <span className="text-base">{plant.emoji}</span>
            <span className="truncate text-foreground font-medium flex-1 text-[11px]">{plant.name}</span>
            {/* Quantity controls */}
            <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
              <button
                onClick={() => setQuantity(plantId, qty - 1)}
                className="h-5 w-5 rounded flex items-center justify-center hover:bg-muted-foreground/10 text-muted-foreground"
                title="Decrease quantity"
              >
                <Minus className="h-2.5 w-2.5" />
              </button>
              <span className={`text-[10px] w-5 text-center font-semibold ${qty === 0 ? 'text-muted-foreground' : 'text-primary'}`}>
                {qty === 0 ? '∞' : qty}
              </span>
              <button
                onClick={() => setQuantity(plantId, qty + 1)}
                className="h-5 w-5 rounded flex items-center justify-center hover:bg-muted-foreground/10 text-muted-foreground"
                title="Increase quantity"
              >
                <Plus className="h-2.5 w-2.5" />
              </button>
            </div>
            <button
              onClick={e => { e.stopPropagation(); e.preventDefault(); toggleFavourite(plantId); }}
              onMouseDown={e => e.stopPropagation()}
              className="shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-amber-500"
              title="Remove from favourites"
            >
              <Star className="h-3 w-3 fill-amber-500" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
export function PlantSidebar({ onDragStart }: PlantSidebarProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [tab, setTab] = useState<'plants' | 'favourites' | 'structures'>('plants');
  const [showFilters, setShowFilters] = useState(false);
  const [difficultyFilter, setDifficultyFilter] = useState<string | null>(null);
  const [seasonFilter, setSeasonFilter] = useState<string | null>(null);
  const [sunFilter, setSunFilter] = useState<string | null>(null);
  const [varietyFilter, setVarietyFilter] = useState<string | null>(null);
  const [groupMode, setGroupMode] = useState<GroupMode>('category');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const { isFavourite, toggleFavourite, reorder, getFavouriteIds, getQuantity, setQuantity } = useFavouritePlants();
  const favouriteIds = getFavouriteIds();

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

  const grouped = useMemo(() => {
    if (groupMode === 'category') {
      return categoryOrder.reduce((acc, cat) => {
        const items = filtered.filter(p => p.category === cat);
        if (items.length > 0) acc.push({ key: cat, label: categoryLabels[cat], items });
        return acc;
      }, [] as { key: string; label: string; items: Plant[] }[]);
    } else {
      const familyMap = new Map<string, Plant[]>();
      for (const p of filtered) {
        const fam = p.family || 'Other';
        if (!familyMap.has(fam)) familyMap.set(fam, []);
        familyMap.get(fam)!.push(p);
      }
      return Array.from(familyMap.entries())
        .sort((a, b) => b[1].length - a[1].length)
        .map(([fam, items]) => ({
          key: fam,
          label: `${familyEmojis[fam] || '🌱'} ${fam}`,
          items,
        }));
    }
  }, [filtered, groupMode]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const activeFilterCount = [difficultyFilter, seasonFilter, sunFilter, varietyFilter].filter(Boolean).length;

  return (
    <div className="w-64 border-r border-border bg-card flex flex-col h-full">
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm text-foreground">🌱 Plant Library <span className="text-muted-foreground font-normal text-xs">({plants.length})</span></h2>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          <button
            onClick={() => setTab('plants')}
            className={`flex items-center gap-1 text-xs px-2.5 py-2 rounded-xl font-semibold transition-colors min-h-[36px] ${tab === 'plants' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            <Leaf className="h-3.5 w-3.5" /> Plants
          </button>
          <button
            onClick={() => setTab('favourites')}
            className={`flex items-center gap-1 text-xs px-2.5 py-2 rounded-xl font-semibold transition-colors min-h-[36px] relative ${tab === 'favourites' ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            <Star className={`h-3.5 w-3.5 ${tab === 'favourites' ? 'fill-white' : ''}`} />
            {favouriteIds.length > 0 && (
              <span className={`text-[10px] ${tab === 'favourites' ? 'text-white/80' : 'text-amber-500'}`}>{favouriteIds.length}</span>
            )}
          </button>
          <button
            onClick={() => setTab('structures')}
            className={`flex items-center gap-1 text-xs px-2.5 py-2 rounded-xl font-semibold transition-colors min-h-[36px] ${tab === 'structures' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            <Building2 className="h-3.5 w-3.5" /> Structures
          </button>
          {tab === 'plants' && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`ml-auto flex items-center gap-1 text-xs px-2 py-2 rounded-xl font-semibold transition-colors min-h-[36px] ${showFilters || activeFilterCount > 0 ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
              title="Filters"
            >
              <Filter className="h-3.5 w-3.5" />
              {activeFilterCount > 0 && <span className="text-[10px]">{activeFilterCount}</span>}
            </button>
          )}
        </div>

        {tab !== 'favourites' && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={tab === 'plants' ? 'Search plants...' : 'Search structures...'}
              className="pl-8 h-9 text-sm rounded-xl"
            />
          </div>
        )}

        {tab === 'plants' && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-muted-foreground whitespace-nowrap">Group by:</span>
              <Select value={groupMode} onValueChange={(v) => setGroupMode(v as GroupMode)}>
                <SelectTrigger className="h-8 text-xs rounded-xl flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="category" className="rounded-lg">Category (Veg/Fruit/Herb)</SelectItem>
                  <SelectItem value="family" className="rounded-lg">Plant Family</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {groupMode === 'category' && (
              <div className="flex flex-wrap gap-1">
                {categoryOrder.map(cat => (
                  <Badge
                    key={cat}
                    variant={activeCategory === cat ? "default" : "outline"}
                    className="cursor-pointer text-xs px-2 py-1 rounded-xl min-h-[28px]"
                    onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                  >
                    {categoryLabels[cat].split(' ')[0]} {categoryLabels[cat].split(' ').slice(1).join(' ')}
                  </Badge>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'plants' && showFilters && (
          <div className="space-y-1.5 p-2.5 bg-muted/50 rounded-xl">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground mb-1">Difficulty</p>
              <div className="flex gap-1">
                {(['easy', 'moderate', 'challenging'] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setDifficultyFilter(difficultyFilter === d ? null : d)}
                    className={`text-[10px] px-2 py-1 rounded-lg font-semibold transition-colors min-h-[28px] ${difficultyFilter === d ? difficultyColors[d] + ' ring-1 ring-current' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground mb-1">Sowing season</p>
              <div className="flex gap-1">
                {['spring', 'summer', 'autumn', 'winter'].map(s => (
                  <button
                    key={s}
                    onClick={() => setSeasonFilter(seasonFilter === s ? null : s)}
                    className={`text-[10px] px-2 py-1 rounded-lg font-semibold transition-colors min-h-[28px] ${seasonFilter === s ? 'bg-primary/15 text-primary ring-1 ring-primary/30' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground mb-1">Sun</p>
              <div className="flex gap-1 flex-wrap">
                {(['full-sun', 'partial-shade', 'any'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setSunFilter(sunFilter === s ? null : s)}
                    className={`text-[10px] px-2 py-1 rounded-lg font-semibold transition-colors min-h-[28px] ${sunFilter === s ? 'bg-secondary/15 text-secondary ring-1 ring-secondary/30' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                  >
                    {sunLabels[s]}
                  </button>
                ))}
              </div>
            </div>
            {availableVarieties.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground mb-1">Variety</p>
                <div className="flex gap-1 flex-wrap">
                  {availableVarieties.map(v => (
                    <button
                      key={v}
                      onClick={() => setVarietyFilter(varietyFilter === v ? null : v)}
                      className={`text-[10px] px-2 py-1 rounded-lg font-semibold transition-colors min-h-[28px] ${varietyFilter === v ? 'bg-primary/15 text-primary ring-1 ring-primary/30' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {activeFilterCount > 0 && (
              <button
                onClick={() => { setDifficultyFilter(null); setSeasonFilter(null); setSunFilter(null); setVarietyFilter(null); }}
                className="text-[10px] text-muted-foreground hover:text-foreground font-semibold"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
        {tab === 'favourites' ? (
          <FavouritesTab
            onDragStart={onDragStart}
            favouriteIds={favouriteIds}
            reorder={reorder}
            toggleFavourite={toggleFavourite}
            getQuantity={getQuantity}
            setQuantity={setQuantity}
          />
        ) : tab === 'plants' ? (
          <>
            {filtered.length > 0 && filtered.length !== plants.length && (
              <p className="text-[10px] text-muted-foreground px-1 font-semibold">{filtered.length} plants</p>
            )}
            {grouped.map(({ key, label, items }) => (
              <Collapsible key={key} open={!collapsedGroups.has(key)} onOpenChange={() => toggleGroup(key)}>
                <CollapsibleTrigger className="flex items-center gap-1.5 w-full px-1.5 py-1.5 rounded-xl hover:bg-muted transition-colors group/trigger">
                  {collapsedGroups.has(key)
                    ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  }
                  <span className="text-xs font-bold text-foreground">{label}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto font-semibold">{items.length}</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid grid-cols-2 gap-1 mt-0.5 mb-1.5">
                    {items.map(plant => (
                      <PlantItem key={plant.id} plant={plant} onDragStart={onDragStart} isFavourite={isFavourite(plant.id)} onToggleFavourite={toggleFavourite} />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">No plants found</p>
            )}
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground px-1">Drag structures onto your plot.</p>
            <div className="space-y-1">
              {filteredStructures.map(structure => (
                <div
                  key={structure.id}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData('structureId', structure.id);
                    onDragStart(structure.id);
                  }}
                  onClick={() => onDragStart(structure.id)}
                  className="flex items-center gap-2 p-2.5 rounded-2xl bg-background hover:bg-muted cursor-pointer active:cursor-grabbing transition-colors text-xs border border-transparent hover:border-border group min-h-[44px]"
                  title={`${structure.description} — tap to select, then tap grid to place`}
                >
                  <span className="text-lg">{structure.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground">{structure.name}</span>
                      {structure.canGrowInside && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-lg bg-primary/15 text-primary font-semibold">Grow</span>
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
