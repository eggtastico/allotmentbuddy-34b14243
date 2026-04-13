import { useMemo, useState } from 'react';
import { PlacedPlant } from '@/types/garden';
import { X, Download, CheckCircle2, Circle } from 'lucide-react';
import {
  generateShoppingList,
  groupByCategory,
  groupByRotation,
  groupBySowingMethod,
  sortByName,
  calculateStats,
  exportToCSV,
} from '@/utils/shoppingListCalculations';
import { ShoppingItem } from '@/lib/shoppingListSchema';

interface ShoppingListProps {
  placedPlants: PlacedPlant[];
  onClose: () => void;
}

type GroupBy = 'category' | 'rotation' | 'sowing-method';

const GROUPBY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'category', label: 'By Category' },
  { value: 'rotation', label: 'By Rotation Group' },
  { value: 'sowing-method', label: 'By Sowing Method' },
];

const ROTATION_LABELS: Record<string, string> = {
  legumes: '🫘 Legumes',
  brassicas: '🥬 Brassicas',
  roots: '🥕 Roots',
  alliums: '🧄 Alliums',
  solanaceae: '🍅 Solanaceae',
  cucurbits: '🥒 Cucurbits',
  leafy: '🥗 Leafy',
  other: '🌱 Other',
};

const CATEGORY_LABELS: Record<string, string> = {
  vegetable: '🥬 Vegetables',
  fruit: '🍓 Fruits',
  herb: '🌿 Herbs',
  flower: '🌸 Flowers',
};

const SOWING_METHOD_LABELS: Record<string, string> = {
  indoors: '🏠 Start Indoors',
  outdoors: '🌍 Direct Sow',
  both: '🔄 Either Method',
};

export function ShoppingList({ placedPlants, onClose }: ShoppingListProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>('category');
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const items = useMemo(() => generateShoppingList(placedPlants), [placedPlants]);

  const grouped = useMemo(() => {
    switch (groupBy) {
      case 'rotation':
        return groupByRotation(items);
      case 'sowing-method':
        return groupBySowingMethod(items);
      case 'category':
      default:
        return groupByCategory(items);
    }
  }, [items, groupBy]);

  const stats = useMemo(() => calculateStats(items), [items]);

  const getGroupLabel = (key: string): string => {
    if (groupBy === 'rotation') return ROTATION_LABELS[key] || key;
    if (groupBy === 'sowing-method') return SOWING_METHOD_LABELS[key] || key;
    return CATEGORY_LABELS[key] || key;
  };

  const toggleItemChecked = (plantId: string) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(plantId)) {
      newChecked.delete(plantId);
    } else {
      newChecked.add(plantId);
    }
    setCheckedItems(newChecked);
  };

  const handleExportCSV = () => {
    exportToCSV(items, 'shopping-list.csv');
  };

  if (items.length === 0) {
    return (
      <div className="fixed inset-0 bg-foreground/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-auto animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between z-10">
            <h2 className="font-bold text-foreground">🛒 Shopping List</h2>
            <button onClick={onClose} className="p-1 rounded hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-8 text-center text-muted-foreground text-sm">
            Add plants to your garden to generate a shopping list
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-foreground/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-auto animate-fade-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between z-10">
          <div>
            <h2 className="font-bold text-foreground">🛒 Shopping List</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.checked}/{stats.total} items • {placedPlants.length} plants placed
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Controls */}
        <div className="border-b border-border p-4 space-y-3">
          <div className="flex gap-2 flex-wrap">
            {GROUPBY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setGroupBy(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  groupBy === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3 py-1.5 bg-muted hover:bg-muted/80 rounded-lg text-xs font-medium transition-colors w-full justify-center"
          >
            <Download className="h-4 w-4" />
            Export as CSV
          </button>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-auto">
          <div className="divide-y divide-border">
            {Array.from(grouped.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([groupKey, groupItems]) => (
                <div key={groupKey}>
                  <div className="sticky top-0 bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground">
                    {getGroupLabel(groupKey)} ({groupItems.length})
                  </div>
                  <div className="divide-y divide-border/50">
                    {sortByName(groupItems).map((item) => (
                      <div
                        key={item.plantId}
                        className="px-4 py-3 hover:bg-muted/30 transition-colors flex items-start gap-3"
                      >
                        <button
                          onClick={() => toggleItemChecked(item.plantId)}
                          className="mt-0.5 flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {checkedItems.has(item.plantId) ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : (
                            <Circle className="h-5 w-5" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span
                              className={`font-medium text-sm ${
                                checkedItems.has(item.plantId)
                                  ? 'line-through text-muted-foreground'
                                  : 'text-foreground'
                              }`}
                            >
                              {item.plantName}
                            </span>
                            {item.variety && (
                              <span className="text-xs text-muted-foreground">({item.variety})</span>
                            )}
                          </div>
                          <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span className="bg-muted px-2 py-0.5 rounded">
                              {item.quantity} {item.unit}
                            </span>
                            {item.sowingMethod && (
                              <span className="bg-muted px-2 py-0.5 rounded">
                                {item.sowingMethod === 'indoors'
                                  ? '🏠 Indoor'
                                  : item.sowingMethod === 'outdoors'
                                    ? '🌍 Outdoor'
                                    : '🔄 Either'}
                              </span>
                            )}
                          </div>
                          {item.notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic">{item.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Footer Stats */}
        <div className="sticky bottom-0 bg-muted/30 border-t border-border p-4 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>
              Progress: {stats.checked}/{stats.total} items purchased
            </span>
            {stats.estimatedCost > 0 && <span>Estimated cost: £{stats.estimatedCost.toFixed(2)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
