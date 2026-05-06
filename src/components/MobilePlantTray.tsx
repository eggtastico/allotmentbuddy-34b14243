import React, { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { plants as allPlantsList } from '@/data/plants';

interface MobilePlantTrayProps {
  pendingPlantId: string | null;
  onSelectPlant: (plantId: string) => void;
}

export function MobilePlantTray({ pendingPlantId, onSelectPlant }: MobilePlantTrayProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = ['Vegetable', 'Fruit', 'Herb', 'Flower'];

  const filteredPlants = activeCategory
    ? allPlantsList.filter(p => p.category === activeCategory.toLowerCase())
    : allPlantsList;

  return (
    <div className="lg:hidden border-t border-border bg-card shrink-0">
      {/* Category filter */}
      <div className="flex gap-1 p-2 overflow-x-auto border-b border-border">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            activeCategory === null
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              activeCategory === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Plant grid - horizontal scroll */}
      <ScrollArea className="h-auto">
        <div className="flex gap-3 p-3">
          {filteredPlants.map((plant) => (
            <button
              key={plant.id}
              onClick={() => onSelectPlant(plant.id)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl min-w-[64px] transition-colors ${
                pendingPlantId === plant.id
                  ? 'bg-primary/20 ring-2 ring-primary'
                  : 'hover:bg-muted'
              }`}
            >
              <span className="text-2xl">{plant.emoji}</span>
              <span className="text-[10px] text-center leading-tight line-clamp-2 text-foreground">
                {plant.name}
              </span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
