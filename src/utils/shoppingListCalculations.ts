/**
 * Shopping List Calculation Utilities
 * Generates shopping items from placed plants with quantities and units
 */

import { PlacedPlant } from '@/types/garden';
import { getPlantById, type Plant } from '@/data/plants';
import { ShoppingItem } from '@/lib/shoppingListSchema';

/**
 * Determine the appropriate unit for purchasing based on plant sowing method
 */
function determineUnit(plantId: string): ShoppingItem['unit'] {
  const plant = getPlantById(plantId);
  if (!plant) return 'plants';

  // Large spacing → seedlings/plants
  if (plant.spacingCm > 30) {
    return plant.sowIndoors ? 'seedlings' : 'plants';
  }

  // Medium spacing → seedlings or seeds
  if (plant.spacingCm > 15) {
    return plant.sowIndoors ? 'seedlings' : 'seeds';
  }

  // Small spacing → seeds
  return 'seeds';
}

/**
 * Determine sowing method
 */
function determineSowingMethod(
  plantId: string
): ShoppingItem['sowingMethod'] {
  const plant = getPlantById(plantId);
  if (!plant) return 'both';

  if (plant.sowIndoors && plant.sowOutdoors) return 'both';
  if (plant.sowIndoors) return 'indoors';
  if (plant.sowOutdoors) return 'outdoors';
  return 'both';
}

/**
 * Calculate quantity multiplier for seeds based on spacing
 */
function getSeedQuantityMultiplier(plant: Plant): number {
  // Small seeds (< 10cm spacing) need bulk - 50-100 seeds per package
  if (plant.spacingCm < 10) return 100;
  // Medium seeds (10-20cm) - 25-50 seeds
  if (plant.spacingCm < 20) return 50;
  // Large seeds (> 20cm) - 10-25 seeds
  return 25;
}

/**
 * Calculate quantity needed for a plant based on number of instances placed
 */
function calculateQuantity(plantId: string, count: number, unit: ShoppingItem['unit']): number {
  const plant = getPlantById(plantId);
  if (!plant) return count;

  if (unit === 'seeds') {
    // For seeds, multiply by a bulk factor depending on seed size
    const multiplier = getSeedQuantityMultiplier(plant);
    return Math.ceil(count * multiplier / 50); // Round to seed packets (~50 seeds each)
  }

  // For seedlings/plants/bulbs/tubers, 1:1 ratio
  return count;
}

/**
 * Generate shopping list from placed plants
 */
export function generateShoppingList(placedPlants: PlacedPlant[]): ShoppingItem[] {
  const plantCounts = new Map<string, number>();

  // Count instances of each plant
  for (const placed of placedPlants) {
    plantCounts.set(placed.plantId, (plantCounts.get(placed.plantId) ?? 0) + 1);
  }

  // Convert to shopping items
  const items: ShoppingItem[] = [];

  for (const [plantId, count] of plantCounts) {
    const plant = getPlantById(plantId);
    if (!plant) continue;

    const unit = determineUnit(plantId);
    const quantity = calculateQuantity(plantId, count, unit);
    const sowingMethod = determineSowingMethod(plantId);

    items.push({
      plantId,
      plantName: plant.name,
      variety: plant.variety,
      quantity,
      unit,
      sowingMethod,
      notes: plant.notes || '',
      checked: false,
    });
  }

  return items;
}

/**
 * Group shopping items by category
 */
export function groupByCategory(items: ShoppingItem[]) {
  const groups = new Map<string, ShoppingItem[]>();

  for (const item of items) {
    const plant = getPlantById(item.plantId);
    if (!plant) continue;

    const category = plant.category;
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category)!.push(item);
  }

  return groups;
}

/**
 * Group shopping items by rotation group
 */
export function groupByRotation(items: ShoppingItem[]) {
  const groups = new Map<string, ShoppingItem[]>();

  for (const item of items) {
    const plant = getPlantById(item.plantId);
    if (!plant) continue;

    const rotation = plant.rotationGroup || 'other';
    if (!groups.has(rotation)) {
      groups.set(rotation, []);
    }
    groups.get(rotation)!.push(item);
  }

  return groups;
}

/**
 * Group shopping items by sowing method
 */
export function groupBySowingMethod(items: ShoppingItem[]) {
  const groups = new Map<string, ShoppingItem[]>();

  for (const item of items) {
    const method = item.sowingMethod;
    if (!groups.has(method)) {
      groups.set(method, []);
    }
    groups.get(method)!.push(item);
  }

  return groups;
}

/**
 * Sort items by plant name
 */
export function sortByName(items: ShoppingItem[]): ShoppingItem[] {
  return [...items].sort((a, b) => a.plantName.localeCompare(b.plantName));
}

/**
 * Calculate shopping list summary stats
 */
export function calculateStats(items: ShoppingItem[]) {
  const total = items.length;
  const checked = items.filter(i => i.checked).length;
  const estimatedCost = items.reduce((sum, i) => sum + (i.estimatedCost ?? 0), 0);

  return { total, checked, estimatedCost };
}

/**
 * Export shopping list as CSV
 */
export function exportToCSV(items: ShoppingItem[], filename = 'shopping-list.csv'): void {
  const headers = ['Plant', 'Variety', 'Quantity', 'Unit', 'Sowing Method', 'Notes', 'Checked'];
  const rows = items.map(item => [
    item.plantName,
    item.variety || '',
    item.quantity,
    item.unit,
    item.sowingMethod,
    item.notes,
    item.checked ? 'Yes' : 'No',
  ]);

  const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
