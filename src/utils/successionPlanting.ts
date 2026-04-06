import { Plant } from '@/types/garden';
import { plants as allPlants, getPlantById } from '@/data/plants';

/**
 * Given a plant that finishes harvest in a certain month,
 * suggest follow-on crops that can be sown after it.
 */

const monthIndex: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function parseMonthRange(range?: string): { start: number; end: number } | null {
  if (!range) return null;
  const parts = range.split('-').map(s => s.trim());
  if (parts.length < 1) return null;
  const start = monthIndex[parts[0]];
  const end = monthIndex[parts[parts.length - 1]];
  if (start === undefined || end === undefined) return null;
  return { start, end };
}

export interface SuccessionSuggestion {
  plant: Plant;
  reason: string;
}

export function getSuccessionSuggestions(finishedPlantId: string, harvestMonth?: number): SuccessionSuggestion[] {
  const finished = getPlantById(finishedPlantId);
  if (!finished) return [];

  // Determine when this crop finishes
  const harvestRange = parseMonthRange(finished.harvest);
  const endMonth = harvestMonth ?? harvestRange?.end ?? 6;

  const suggestions: SuccessionSuggestion[] = [];

  for (const candidate of allPlants) {
    if (candidate.id === finishedPlantId) continue;
    // Must be a different rotation group (avoid soil depletion)
    if (candidate.rotationGroup === finished.rotationGroup) continue;

    // Can the candidate be sown after the finished crop?
    const sowRange = parseMonthRange(candidate.sowOutdoors || candidate.sowIndoors);
    if (!sowRange) continue;

    // Check if sowing window overlaps with or comes after harvest end
    const canSowAfter = sowRange.start <= endMonth + 1 && sowRange.end >= endMonth;
    const canSowLater = sowRange.start >= endMonth;

    if (canSowAfter || canSowLater) {
      // Bonus if it's a companion
      const isCompanion = finished.companions.includes(candidate.id);
      const isEnemy = finished.enemies.includes(candidate.id);
      if (isEnemy) continue;

      let reason = `Can sow ${candidate.sowOutdoors || candidate.sowIndoors} after ${finished.name}`;
      if (isCompanion) reason += ' (companion)';
      if (candidate.rotationGroup === 'legumes') reason += ' — fixes nitrogen';

      suggestions.push({ plant: candidate, reason });
    }
  }

  // Sort: companions first, then fast-growing
  return suggestions
    .sort((a, b) => {
      const aComp = finished.companions.includes(a.plant.id) ? 0 : 1;
      const bComp = finished.companions.includes(b.plant.id) ? 0 : 1;
      if (aComp !== bComp) return aComp - bComp;
      return (a.plant.daysToHarvest || 99) - (b.plant.daysToHarvest || 99);
    })
    .slice(0, 6);
}