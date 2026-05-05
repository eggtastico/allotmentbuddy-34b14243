/**
 * Crop Rotation Utility
 * Handles 4-year rotation tracking, warnings, suggestions, and forecasting per bed.
 */

import { PlacedStructure, PlacedPlant, RotationYearEntry, Plant } from '@/types/garden';
import { getPlantById } from '@/data/plants';

const FOUR_YEAR_CYCLE = ['legumes', 'brassicas', 'roots', 'solanaceae'];

/**
 * Get all plants placed within a specific bed.
 * A plant is in the bed if its position falls within the bed's bounding box.
 */
export function getPlantsInBed(bed: PlacedStructure, plants: PlacedPlant[]): PlacedPlant[] {
  return plants.filter(p => {
    const plantData = getPlantById(p.plantId);
    if (!plantData) return false;

    // Check if plant position falls within bed bounds
    const plantWidth = p.areaW ?? 1;
    const plantHeight = p.areaH ?? 1;

    // Plant occupies cells from (x, y) to (x + width - 1, y + height - 1)
    // Bed occupies cells from (bed.x, bed.y) to (bed.x + bed.widthCells - 1, bed.y + bed.heightCells - 1)
    return (
      p.x >= bed.x &&
      p.x + plantWidth <= bed.x + bed.widthCells &&
      p.y >= bed.y &&
      p.y + plantHeight <= bed.y + bed.heightCells
    );
  });
}

/**
 * Determine the dominant rotation group for plants in a bed.
 * Returns the most common group among all plants (excluding 'other').
 * Ties are broken by FOUR_YEAR_CYCLE order.
 * Returns null if bed is empty or all plants are 'other'.
 */
export function getDominantRotationGroup(plants: PlacedPlant[]): string | null {
  const groups = new Map<string, number>();

  for (const plant of plants) {
    const plantData = getPlantById(plant.plantId);
    if (!plantData || plantData.rotationGroup === 'other') continue;
    groups.set(plantData.rotationGroup, (groups.get(plantData.rotationGroup) ?? 0) + 1);
  }

  if (groups.size === 0) return null;

  // Find the group with highest count, breaking ties by FOUR_YEAR_CYCLE order
  let maxCount = 0;
  let dominant: string | null = null;

  for (const group of FOUR_YEAR_CYCLE) {
    const count = groups.get(group) ?? 0;
    if (count > maxCount) {
      maxCount = count;
      dominant = group;
    }
  }

  // If no FOUR_YEAR_CYCLE groups found, return any group with highest count
  if (dominant === null) {
    for (const [group, count] of groups) {
      if (dominant === null || count > (groups.get(dominant) ?? 0)) {
        dominant = group;
      }
    }
  }

  return dominant;
}

export interface RotationTableRow {
  year: number;
  group: string | null;
  source: 'history' | 'current' | 'forecast'; // 'history' from rotationHistory, 'current' is this year, 'forecast' is computed
  isWarning?: boolean;
}

/**
 * Build a 7-row rotation history table showing 3 years before, current, and 3 years after.
 * Pulls actual history from rotationHistory array, uses currentGroup for current year,
 * and forecasts future years based on FOUR_YEAR_CYCLE.
 */
export function buildRotationTable(
  history: RotationYearEntry[] | undefined,
  currentYear: number,
  currentGroup: string | null
): RotationTableRow[] {
  const historyMap = new Map((history ?? []).map(e => [e.year, e.group]));
  const rows: RotationTableRow[] = [];

  for (let year = currentYear - 3; year <= currentYear + 3; year++) {
    if (year === currentYear) {
      rows.push({ year, group: currentGroup, source: 'current' });
    } else if (historyMap.has(year)) {
      rows.push({ year, group: historyMap.get(year) ?? null, source: 'history' });
    } else if (year > currentYear && currentGroup && FOUR_YEAR_CYCLE.includes(currentGroup)) {
      // Forecast future years in the cycle
      const currentIndex = FOUR_YEAR_CYCLE.indexOf(currentGroup);
      const yearsAhead = year - currentYear;
      const forecastIndex = (currentIndex + yearsAhead) % 4;
      rows.push({ year, group: FOUR_YEAR_CYCLE[forecastIndex], source: 'forecast' });
    } else {
      rows.push({ year, group: null, source: 'forecast' });
    }
  }

  return rows;
}

/**
 * Get rotation warnings for a bed based on its history and current group.
 * Returns array of warning strings, empty if no issues.
 * Warnings include:
 * - Same as last year
 * - Planted within 3 years (ideally wait 4 years for full rotation)
 */
export function getRotationWarnings(
  history: RotationYearEntry[] | undefined,
  currentYear: number,
  currentGroup: string | null
): string[] {
  if (!currentGroup || !history || history.length === 0) return [];

  const warnings: string[] = [];
  const historyMap = new Map(history.map(e => [e.year, e.group]));

  // Check if same as last year
  const lastYear = currentYear - 1;
  if (historyMap.has(lastYear) && historyMap.get(lastYear) === currentGroup) {
    warnings.push('Same group as last year — move to a different bed');
  }

  // Check if planted in recent 3-year window (ideally wait 4 years)
  for (let year = currentYear - 3; year < currentYear; year++) {
    if (historyMap.has(year) && historyMap.get(year) === currentGroup) {
      const yearsAgo = currentYear - year;
      warnings.push(
        `This group was here ${yearsAgo} year${yearsAgo > 1 ? 's' : ''} ago — ideally wait 4 years`
      );
      break; // Only show the first (closest) conflict
    }
  }

  return warnings;
}

/**
 * Get a suggestion for the next group to plant in this bed.
 * Based on the current group and FOUR_YEAR_CYCLE.
 * Returns null if current group is not in the cycle.
 */
export function getNextGroupSuggestion(
  currentGroup: string | null
): { group: string; reason: string } | null {
  if (!currentGroup || !FOUR_YEAR_CYCLE.includes(currentGroup)) return null;

  const currentIndex = FOUR_YEAR_CYCLE.indexOf(currentGroup);
  const nextIndex = (currentIndex + 1) % 4;
  const nextGroup = FOUR_YEAR_CYCLE[nextIndex];

  const reasons: Record<string, string> = {
    legumes: 'Adds nitrogen to soil',
    brassicas: 'Benefits from nitrogen left by legumes',
    roots: 'Prevents disease buildup',
    solanaceae: 'Completes 4-year rotation',
  };

  return {
    group: nextGroup,
    reason: reasons[nextGroup] || 'Next in 4-year cycle',
  };
}

/**
 * Get a human-readable display name for a bed.
 * Falls back to "Bed N" if no custom name is set.
 */
export function getBedDisplayName(bed: PlacedStructure, allBeds: PlacedStructure[]): string {
  if (bed.name) return bed.name;
  const index = allBeds.findIndex(b => b.id === bed.id);
  return `Bed ${index + 1}`;
}

/**
 * Get the rotation status badge type based on warnings.
 */
export function getRotationStatus(warnings: string[]): 'good' | 'warning' {
  return warnings.length > 0 ? 'warning' : 'good';
}
