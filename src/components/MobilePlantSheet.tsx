import React, { useState, useMemo, useRef, useCallback } from 'react';
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

interface MobilePlantSheetProps {
  pendingPlantId: string | null;
  onSelectPlant: (plantId: string) => void;
  visible: boolean;
}

type SheetPosition = 'collapsed' | 'half' | 'full';
type SheetTab = 'recent' | 'all' | 'vegetable' | 'fruit' | 'herb' | 'flower';

/** Height of the collapsed handle bar */
const HANDLE_HEIGHT = 48;
/** Bottom offset to sit above bottom nav */
const BOTTOM_OFFSET = 80;
/** Minimum velocity (px/ms) to trigger a snap via swipe */
const VELOCITY_THRESHOLD = 0.4;
/** Minimum distance (px) to trigger a snap without velocity */
const DISTANCE_THRESHOLD = 60;

export function MobilePlantSheet({ pendingPlantId, onSelectPlant, visible }: MobilePlantSheetProps) {
  const [position, setPosition] = useState<SheetPosition>('collapsed');
  const [activeTab, setActiveTab] = useState<SheetTab>('recent');
  const [recentIds, setRecentIds] = useState<string[]>(() => getRecentIds());
  const [searchQuery, setSearchQuery] = useState('');
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const touchStartRef = useRef<{ y: number; time: number } | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const currentMonth = new Date().getMonth();

  /** Get the sheet height (from bottom of sheet to its top) for each position */
  const getSheetHeight = useCallback((pos: SheetPosition): number => {
    const vh = window.innerHeight;
    switch (pos) {
      case 'collapsed': return HANDLE_HEIGHT;
      case 'half': return Math.round(vh * 0.4);
      case 'full': return Math.round(vh * 0.85);
    }
  }, []);

  /** Get the translateY value for a position (lower = more visible) */
  const getTranslateY = useCallback((pos: SheetPosition): number => {
    const sheetHeight = getSheetHeight(pos);
    // The sheet is positioned with bottom at BOTTOM_OFFSET.
    // TranslateY moves it down from its "full" position.
    const fullHeight = getSheetHeight('full');
    return fullHeight - sheetHeight;
  }, [getSheetHeight]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = {
      y: e.touches[0].clientY,
      time: Date.now(),
    };
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const deltaY = e.touches[0].clientY - touchStartRef.current.y;
    setDragOffset(deltaY);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current) {
      setIsDragging(false);
      setDragOffset(0);
      return;
    }

    const deltaY = dragOffset;
    const elapsed = Date.now() - touchStartRef.current.time;
    const velocity = Math.abs(deltaY) / Math.max(elapsed, 1); // px/ms

    const swipedUp = deltaY < 0;
    const swipedDown = deltaY > 0;
    const isFastSwipe = velocity > VELOCITY_THRESHOLD;
    const isLongSwipe = Math.abs(deltaY) > DISTANCE_THRESHOLD;

    let nextPosition: SheetPosition = position;

    if (isFastSwipe || isLongSwipe) {
      if (swipedUp) {
        // Swiping up: expand
        if (position === 'collapsed') nextPosition = 'half';
        else if (position === 'half') nextPosition = 'full';
      } else if (swipedDown) {
        // Swiping down: collapse
        if (position === 'full') nextPosition = 'half';
        else if (position === 'half') nextPosition = 'collapsed';
      }
    }

    setPosition(nextPosition);
    setDragOffset(0);
    setIsDragging(false);
    touchStartRef.current = null;
  }, [dragOffset, position]);

  const handleHandleTap = useCallback(() => {
    // If collapsed and user taps (no significant drag), open to half
    if (position === 'collapsed') {
      setPosition('half');
    }
  }, [position]);

  const handleSelect = useCallback((plantId: string) => {
    navigator.vibrate?.(8);
    addRecentId(plantId);
    setRecentIds(getRecentIds());
    onSelectPlant(plantId);
  }, [onSelectPlant]);

  const displayedPlants = useMemo(() => {
    let plants: typeof allPlantsList;

    if (activeTab === 'recent') {
      plants = recentIds.map(id => getPlantById(id)).filter(Boolean) as typeof allPlantsList;
    } else {
      const base = activeTab === 'all'
        ? [...allPlantsList]
        : allPlantsList.filter(p => p.category === activeTab);
      // Sort: in-season first, then alphabetical
      plants = base.sort((a, b) => {
        const aSow = getSowingStatus(a, currentMonth).canSowNow;
        const bSow = getSowingStatus(b, currentMonth).canSowNow;
        if (aSow && !bSow) return -1;
        if (!aSow && bSow) return 1;
        return a.name.localeCompare(b.name);
      });
    }

    // Apply search filter (only in full state, but filter always if query present)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      plants = plants.filter(p => p.name.toLowerCase().includes(q));
    }

    return plants;
  }, [activeTab, recentIds, currentMonth, searchQuery]);

  const tabs: { id: SheetTab; label: string }[] = [
    { id: 'recent', label: 'Recent' },
    { id: 'all', label: 'All' },
    { id: 'vegetable', label: 'Veg' },
    { id: 'fruit', label: 'Fruit' },
    { id: 'herb', label: 'Herb' },
    { id: 'flower', label: 'Flower' },
  ];

  if (!visible) return null;

  // Compute the current translateY based on position + drag offset
  const baseTranslateY = getTranslateY(position);
  // Clamp drag so we can't go above full or below collapsed
  const maxTranslateY = getTranslateY('collapsed');
  const minTranslateY = getTranslateY('full'); // 0
  const currentTranslateY = Math.max(minTranslateY, Math.min(maxTranslateY, baseTranslateY + dragOffset));

  const fullHeight = getSheetHeight('full');

  return (
    <div
      ref={sheetRef}
      className="fixed left-0 right-0 bg-card rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] lg:hidden"
      style={{
        bottom: `${BOTTOM_OFFSET}px`,
        height: `${fullHeight}px`,
        transform: `translateY(${currentTranslateY}px)`,
        transition: isDragging ? 'none' : 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)',
        zIndex: 25,
      }}
    >
      {/* Handle bar - always visible, swipeable */}
      <div
        className="flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none"
        style={{ height: `${HANDLE_HEIGHT}px` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleHandleTap}
      >
        {/* Drag indicator */}
        <div className="w-10 h-1 rounded-full bg-muted-foreground/30 mb-1" />
        <span className="text-xs font-medium text-muted-foreground">Plants</span>
      </div>

      {/* Content area */}
      <div className="flex flex-col overflow-hidden" style={{ height: `${fullHeight - HANDLE_HEIGHT}px` }}>
        {/* Search input - only visible in full state */}
        {position === 'full' && (
          <div className="px-3 pb-2">
            <input
              type="text"
              placeholder="Search plants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        )}

        {/* Category tabs - horizontal scroll, pill style */}
        <div className="flex gap-1.5 px-3 pb-2 overflow-x-auto scrollbar-none shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Plant grid - 4 columns, scrollable */}
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {displayedPlants.length === 0 && activeTab === 'recent' && !searchQuery && (
            <p className="text-xs text-muted-foreground px-2 py-4 italic text-center">
              Select a plant from another tab to add it here
            </p>
          )}
          {displayedPlants.length === 0 && searchQuery && (
            <p className="text-xs text-muted-foreground px-2 py-4 italic text-center">
              No plants match "{searchQuery}"
            </p>
          )}
          <div className="grid grid-cols-4 gap-1">
            {displayedPlants.map((plant) => {
              const sow = getSowingStatus(plant, currentMonth);
              return (
                <button
                  key={plant.id}
                  onClick={() => handleSelect(plant.id)}
                  className={`flex flex-col items-center justify-center gap-0.5 p-1.5 rounded-xl transition-colors relative ${
                    pendingPlantId === plant.id
                      ? 'bg-primary/20 ring-2 ring-primary'
                      : 'hover:bg-muted active:bg-muted'
                  }`}
                  style={{ minHeight: '72px', minWidth: '60px' }}
                >
                  {/* In-season green dot badge */}
                  {sow.canSowNow && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500" />
                  )}
                  <span className="text-[32px] leading-none">{plant.emoji}</span>
                  <span className="text-[10px] text-center leading-tight line-clamp-2 text-foreground w-full mt-0.5">
                    {plant.name}
                  </span>
                  {sow.canSowNow && (
                    <span className={`text-[8px] px-1 rounded-full font-semibold leading-none ${
                      sow.sowOutdoorsNow ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {sow.sowOutdoorsNow ? 'outdoor' : 'indoor'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
