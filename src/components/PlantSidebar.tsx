import { useState } from 'react';
import { plants } from '@/data/plants';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';

const categoryOrder = ['vegetable', 'fruit', 'herb', 'flower'] as const;
const categoryLabels = { vegetable: '🥦 Vegetables', fruit: '🍓 Fruits', herb: '🌿 Herbs', flower: '🌼 Flowers' };

interface PlantSidebarProps {
  onDragStart: (plantId: string) => void;
}

export function PlantSidebar({ onDragStart }: PlantSidebarProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = plants.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !activeCategory || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const grouped = categoryOrder.reduce((acc, cat) => {
    const items = filtered.filter(p => p.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {} as Record<string, typeof plants>);

  return (
    <div className="w-64 border-r border-border bg-card flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <h2 className="font-semibold text-sm mb-2 text-foreground">🌱 Plant Library</h2>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search plants..."
            className="pl-7 h-8 text-sm"
          />
        </div>
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
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-3">
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat}>
            <p className="text-xs font-medium text-muted-foreground px-1 mb-1">
              {categoryLabels[cat as keyof typeof categoryLabels]}
            </p>
            <div className="grid grid-cols-2 gap-1">
              {items.map(plant => (
                <div
                  key={plant.id}
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
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">No plants found</p>
        )}
      </div>
    </div>
  );
}
