import React, { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { plants as allPlantsList, getPlantById } from '@/data/plants';
import { getSowingStatus } from '@/utils/seasonalSowing';

const RECENT_KEY = 'allotment-recent-plants';
const MAX_RECENT = 20;

function getRecentIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function addRecentId(plantId: string) {
  const ids = getRecentIds().filter(id => id !== plantId);
  ids.unshift(plantId);
  localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
}

interface MobilePlantTrayProps {
  pendingPlantId: string | null;
  onSelectPlant: (plantId: string) => void;
}

type TrayTab = 'recent' | 'vegetable' | 'fruit' | 'herb' | 'flower' | 'all';

export function MobilePlantTray({ pendingPlantId, onSelectPlant }: MobilePlantTrayProps) {
  const [activeTab, setActiveTab] = useState<TrayTab>('recent');
  const [recentIds, setRecentIds] = useState<string[]>(() => getRecentIds());

  const currentMonth = new Date().getMonth();

  const handleSelect = (plantId: string) => {
    addRecentId(plantId);
    setRecentIds(getRecentIds());
    onSelectPlant(plantId);
  };

  const displayedPlants = useMemo(() => {
    if (activeTab === 'recent') {
      return recentIds.map(id => getPlantById(id)).filter(Boolean) as typeof allPlantsList;
    }
    const base = activeTab === 'all'
      ? [...allPlantsList]
      : allPlantsList.filter(p => p.category === activeTab);
    // Sort: in-season first, then alphabetical
    return base.sort((a, b) => {
      const aSow = getSowingStatus(a, currentMonth).canSowNow;
      const bSow = getSowingStatus(b, currentMonth).canSowNow;
      if (aSow && !bSow) return -1;
      if (!aSow && bSow) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [activeTab, recentIds, currentMonth]);

  const tabs: { id: TrayTab; label: string }[] = [
    { id: 'recent', label: '🕐 Recent' },
    { id: 'all', label: 'All' },
    { id: 'vegetable', label: '🥕 Veg' },
    { id: 'fruit', label: '🍓 Fruit' },
    { id: 'herb', label: '🌿 Herb' },
    { id: 'flower', label: '🌸 Flower' },
  ];

  return (
    <div className="lg:hidden border-t border-border bg-card shrink-0">
      {/* Tab filter */}
      <div className="flex gap-1 px-2 pt-1.5 pb-1 overflow-x-auto scrollbar-none border-b border-border">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Plant row — horizontal scroll */}
      <ScrollArea className="h-auto">
        <div className="flex gap-2 px-2 py-2">
          {displayedPlants.length === 0 && activeTab === 'recent' && (
            <p className="text-xs text-muted-foreground px-1 py-1 italic">
              Tap a plant from another tab to add it here
            </p>
          )}
          {displayedPlants.map((plant) => {
            const sow = getSowingStatus(plant, currentMonth);
            return (
              <button
                key={plant.id}
                onClick={() => handleSelect(plant.id)}
                className={`flex flex-col items-center gap-0.5 p-2 rounded-xl min-w-[60px] max-w-[60px] transition-colors ${
                  pendingPlantId === plant.id
                    ? 'bg-primary/20 ring-2 ring-primary'
                    : 'hover:bg-muted active:bg-muted'
                }`}
              >
                <span className="text-2xl leading-none">{plant.emoji}</span>
                {sow.canSowNow && (
                  <span className={`text-[8px] px-1 py-0.5 rounded-full font-semibold leading-none mt-0.5 ${
                    sow.sowOutdoorsNow ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {sow.sowOutdoorsNow ? '🌿' : '🏠'}
                  </span>
                )}
                <span className="text-[9px] text-center leading-tight line-clamp-2 text-foreground w-full mt-0.5">
                  {plant.name}
                </span>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
