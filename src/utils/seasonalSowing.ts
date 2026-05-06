/**
 * Seasonal Sowing Utility
 * Parses month ranges from plant data (sowIndoors / sowOutdoors) to determine
 * whether a plant is currently in its sowing window.
 */

import type { Plant } from '@/types/garden';

const MONTH_ABBREVS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Parse a month abbreviation string (e.g. "Feb", "Mar") into a 0-based month index.
 * Returns -1 if unrecognised.
 */
function parseMonth(str: string): number {
  const key = str.trim().toLowerCase().slice(0, 3);
  return MONTH_ABBREVS[key] ?? -1;
}

/**
 * Given a range string like "Feb-Mar", "Oct-Nov", "Mar-Sep", or a single month
 * like "Apr" or "May", return the set of 0-based month indices it covers.
 * Handles wrap-around ranges (e.g. "Oct-Mar" = Oct,Nov,Dec,Jan,Feb,Mar).
 */
function monthRangeToSet(range: string): Set<number> {
  const months = new Set<number>();
  if (!range) return months;

  const parts = range.split('-').map(s => s.trim());
  if (parts.length === 1) {
    const m = parseMonth(parts[0]);
    if (m >= 0) months.add(m);
    return months;
  }

  const start = parseMonth(parts[0]);
  const end = parseMonth(parts[1]);
  if (start < 0 || end < 0) return months;

  if (start <= end) {
    for (let i = start; i <= end; i++) months.add(i);
  } else {
    // Wrap-around (e.g. Oct-Mar)
    for (let i = start; i < 12; i++) months.add(i);
    for (let i = 0; i <= end; i++) months.add(i);
  }

  return months;
}

export interface SowingStatus {
  /** Whether the plant can be sown (indoors or outdoors) this month */
  canSowNow: boolean;
  /** Whether sowing indoors applies this month */
  sowIndoorsNow: boolean;
  /** Whether sowing outdoors applies this month */
  sowOutdoorsNow: boolean;
  /** Short label for display */
  label: string;
}

/**
 * Determine a plant's sowing status for a given month (0-based).
 * Defaults to the current month if none provided.
 */
export function getSowingStatus(plant: Plant, month?: number): SowingStatus {
  const m = month ?? new Date().getMonth();

  const indoorMonths = plant.sowIndoors ? monthRangeToSet(plant.sowIndoors) : new Set<number>();
  const outdoorMonths = plant.sowOutdoors ? monthRangeToSet(plant.sowOutdoors) : new Set<number>();

  const sowIndoorsNow = indoorMonths.has(m);
  const sowOutdoorsNow = outdoorMonths.has(m);
  const canSowNow = sowIndoorsNow || sowOutdoorsNow;

  let label = '';
  if (sowIndoorsNow && sowOutdoorsNow) {
    label = 'Sow now';
  } else if (sowIndoorsNow) {
    label = 'Sow indoors';
  } else if (sowOutdoorsNow) {
    label = 'Sow outdoors';
  }

  return { canSowNow, sowIndoorsNow, sowOutdoorsNow, label };
}

/**
 * Get the display name for a month index.
 */
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export function getMonthName(month?: number): string {
  const m = month ?? new Date().getMonth();
  return MONTH_NAMES[m] ?? '';
}

/**
 * Seasonal status of a planted plant — determines how it appears on the grid.
 */
export type PlantSeasonStatus = 'active' | 'harvest-ready' | 'dormant';

/**
 * Determine a plant's seasonal status (active, harvest-ready, or dormant) for a given month.
 *
 * A plant is:
 * - 'harvest-ready' if it's in its harvest window AND has been in the ground long enough
 * - 'active' if it's in any sowing or harvest month
 * - 'dormant' if it's not in season
 */
export function getPlantSeasonStatus(
  plant: Plant,
  placedAt: string,
  viewMonth: number
): PlantSeasonStatus {
  // Handle "Year-round" plants
  if (plant.harvest?.toLowerCase().includes('year')) {
    return 'active';
  }

  // Check if in harvest window and has been growing long enough
  if (plant.harvest) {
    const harvestMonths = monthRangeToSet(plant.harvest);
    if (harvestMonths.has(viewMonth)) {
      try {
        const planted = new Date(placedAt);
        const daysInGround = (Date.now() - planted.getTime()) / 86400000;
        const daysToHarvest = plant.daysToHarvest ?? 90;
        // Consider ready if 85% of growth period has passed
        if (daysInGround >= daysToHarvest * 0.85) {
          return 'harvest-ready';
        }
      } catch {
        // Invalid date — skip harvest-ready check
      }
    }
  }

  // Check if in any sowing or harvest month
  const sowIndoorMonths = plant.sowIndoors ? monthRangeToSet(plant.sowIndoors) : new Set<number>();
  const sowOutdoorMonths = plant.sowOutdoors ? monthRangeToSet(plant.sowOutdoors) : new Set<number>();
  const harvestMonths = plant.harvest ? monthRangeToSet(plant.harvest) : new Set<number>();

  const allActiveMonths = new Set([...sowIndoorMonths, ...sowOutdoorMonths, ...harvestMonths]);

  if (allActiveMonths.size === 0) {
    // No seasonal data — assume always active
    return 'active';
  }

  if (allActiveMonths.has(viewMonth)) {
    return 'active';
  }

  return 'dormant';
}
