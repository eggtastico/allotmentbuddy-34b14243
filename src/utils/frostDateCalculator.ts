/**
 * Frost Date Calculator Utility
 * Calculates last and first frost dates based on location (latitude/longitude)
 * Uses USDA hardiness zones and average historical frost dates
 */

export interface FrostDates {
  lastFrostDate: Date;
  firstFrostDate: Date;
  frostFreeDays: number;
}

/**
 * Determine USDA hardiness zone from latitude
 * Simplified mapping based on latitude (primary factor in Northern Hemisphere)
 */
function getHardinessZone(latitude: number): number {
  // USDA zones 1-13, mapped roughly by latitude in Northern Hemisphere
  // Zone boundaries are approximate
  if (latitude > 68) return 1; // Far north
  if (latitude > 62) return 2;
  if (latitude > 56) return 3;
  if (latitude > 50) return 4; // UK/Northern US
  if (latitude > 44) return 5; // Most of UK/Northern US
  if (latitude > 38) return 6; // Southern UK/Central US
  if (latitude > 32) return 7;
  if (latitude > 26) return 8;
  if (latitude > 20) return 9;
  if (latitude > 14) return 10;
  return 11; // Tropical
}

/**
 * Average frost dates by USDA hardiness zone
 * Last Frost Date (spring) and First Frost Date (fall) for Northern Hemisphere
 * Expressed as day of year (1-366)
 * lastFrost = last spring frost (when to start planting)
 * firstFrost = first fall frost (when to stop planting, harvest sensitive crops)
 */
const ZONE_FROST_DATES: Record<number, { lastFrost: number; firstFrost: number }> = {
  1: { lastFrost: 210, firstFrost: 109 }, // Zone 1: Very short season (109 days)
  2: { lastFrost: 200, firstFrost: 119 }, // Zone 2: Short season (119 days)
  3: { lastFrost: 190, firstFrost: 139 }, // Zone 3: ~149 days
  4: { lastFrost: 140, firstFrost: 263 }, // Zone 4: ~123 days frost-free (May 20 - Sept 20)
  5: { lastFrost: 130, firstFrost: 273 }, // Zone 5: ~143 days frost-free
  6: { lastFrost: 120, firstFrost: 283 }, // Zone 6: ~163 days frost-free
  7: { lastFrost: 110, firstFrost: 293 }, // Zone 7: ~183 days frost-free
  8: { lastFrost: 100, firstFrost: 303 }, // Zone 8: ~203 days frost-free
  9: { lastFrost: 90, firstFrost: 313 }, // Zone 9: ~223 days frost-free
  10: { lastFrost: 80, firstFrost: 323 }, // Zone 10: ~243 days frost-free
  11: { lastFrost: 70, firstFrost: 333 }, // Zone 11: ~263 days frost-free
  13: { lastFrost: 50, firstFrost: 350 }, // Zone 13: Very long season (300 days)
};

/**
 * Get frost dates for a specific location
 * @param latitude - Location latitude (-90 to 90)
 * @param longitude - Location longitude (-180 to 180, not used in simplified version)
 * @returns Frost dates as Date objects
 */
export function getFrostDates(latitude: number, longitude?: number): FrostDates {
  const zone = getHardinessZone(latitude);
  const zoneData = ZONE_FROST_DATES[zone] || ZONE_FROST_DATES[5]; // Default to zone 5

  const currentYear = new Date().getFullYear();
  const lastFrost = dayOfYearToDate(zoneData.lastFrost, currentYear);
  const firstFrost = dayOfYearToDate(zoneData.firstFrost, currentYear);

  // Calculate frost-free days
  const frostFreeMs = firstFrost.getTime() - lastFrost.getTime();
  const frostFreeDays = Math.round(frostFreeMs / (1000 * 60 * 60 * 24));

  return { lastFrostDate: lastFrost, firstFrostDate: firstFrost, frostFreeDays };
}

/**
 * Convert day of year (1-366) to Date object
 */
function dayOfYearToDate(dayOfYear: number, year: number): Date {
  const date = new Date(year, 0, 1);
  date.setDate(date.getDate() + dayOfYear - 1);
  return date;
}

/**
 * Check if a date is within the frost-free window
 */
export function isInFrostFreeWindow(date: Date, frostDates: FrostDates): boolean {
  return date >= frostDates.lastFrostDate && date <= frostDates.firstFrostDate;
}

/**
 * Get planting recommendation based on frost hardiness and frost dates
 */
export function getPlantingRecommendation(
  frostHardiness: 'hardy' | 'half-hardy' | 'tender' | undefined,
  frostDates: FrostDates
): {
  plantingWindow: { start: Date; end: Date } | null;
  recommendation: string;
  color: 'green' | 'yellow' | 'red';
} {
  const today = new Date();
  const daysBefore = Math.floor((frostDates.lastFrostDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (!frostHardiness) {
    // No hardiness info, assume moderate
    return {
      plantingWindow: null,
      recommendation: 'Plant after last frost date',
      color: 'yellow',
    };
  }

  if (frostHardiness === 'hardy') {
    // Can plant anytime, but prefer spring/fall
    return {
      plantingWindow: {
        start: new Date(today.getFullYear(), 0, 1), // Jan 1
        end: new Date(today.getFullYear(), 11, 31), // Dec 31
      },
      recommendation: 'Can plant year-round. Best in spring or fall.',
      color: 'green',
    };
  }

  if (frostHardiness === 'half-hardy') {
    // Can tolerate light frosts, plant after hard frosts
    const buffer = 14; // 2 weeks after last frost for safety
    const plantAfter = new Date(frostDates.lastFrostDate.getTime() + buffer * 24 * 60 * 60 * 1000);
    const plantBefore = new Date(frostDates.firstFrostDate.getTime() - buffer * 24 * 60 * 60 * 1000);

    if (daysBefore > 0) {
      return {
        plantingWindow: { start: plantAfter, end: plantBefore },
        recommendation: `Wait ${daysBefore} days before planting. Plant after ${formatDate(plantAfter)}.`,
        color: 'yellow',
      };
    } else {
      return {
        plantingWindow: { start: plantAfter, end: plantBefore },
        recommendation: `Ready to plant. Window: ${formatDate(plantAfter)} to ${formatDate(plantBefore)}`,
        color: 'green',
      };
    }
  }

  if (frostHardiness === 'tender') {
    // Cannot tolerate any frost
    const buffer = 7; // 1 week after last frost for safety
    const plantAfter = new Date(frostDates.lastFrostDate.getTime() + buffer * 24 * 60 * 60 * 1000);
    const plantBefore = new Date(frostDates.firstFrostDate.getTime() - buffer * 24 * 60 * 60 * 1000);

    if (daysBefore > 0) {
      return {
        plantingWindow: null,
        recommendation: `Too early. Wait ${daysBefore} days. Plant after ${formatDate(plantAfter)}.`,
        color: 'red',
      };
    } else {
      return {
        plantingWindow: { start: plantAfter, end: plantBefore },
        recommendation: `Ready to plant. Window: ${formatDate(plantAfter)} to ${formatDate(plantBefore)}`,
        color: 'green',
      };
    }
  }

  return {
    plantingWindow: null,
    recommendation: 'Planting information unavailable',
    color: 'yellow',
  };
}

/**
 * Format date as "MMM D" (e.g., "May 15")
 */
function formatDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Get color coding for a plant's frost safety at current date
 */
export function getFrostSafetyColor(
  frostHardiness: 'hardy' | 'half-hardy' | 'tender' | undefined,
  frostDates: FrostDates
): 'green' | 'yellow' | 'red' {
  const rec = getPlantingRecommendation(frostHardiness, frostDates);
  return rec.color;
}

/**
 * Format frost dates as human-readable string
 */
export function formatFrostDates(frostDates: FrostDates): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const last = frostDates.lastFrostDate;
  const first = frostDates.firstFrostDate;
  const lastStr = `${months[last.getMonth()]} ${last.getDate()}`;
  const firstStr = `${months[first.getMonth()]} ${first.getDate()}`;
  return `${lastStr} to ${firstStr} (${frostDates.frostFreeDays} days)`;
}
