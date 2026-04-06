import { Plant } from '@/types/garden';
import { plants as allPlants } from '@/data/plants';
import { Structure } from '@/data/structures';
import { getSuccessionSuggestions, SuccessionSuggestion } from './successionPlanting';

/**
 * Given a bed/container size in cells and cell size in cm,
 * suggest plants that fit well and utilise the space.
 */

export interface BedPlantSuggestion {
  plant: Plant;
  fitCount: number; // how many can fit in this bed
  reason: string;
}

export function suggestPlantsForBed(
  widthCells: number,
  heightCells: number,
  cellSizeCm: number,
  isContainer?: boolean,
  favouriteIds?: string[],
): BedPlantSuggestion[] {
  const bedWidthCm = widthCells * cellSizeCm;
  const bedHeightCm = heightCells * cellSizeCm;
  const bedAreaCm2 = bedWidthCm * bedHeightCm;

  const suggestions: BedPlantSuggestion[] = [];

  for (const plant of allPlants) {
    const spacing = plant.spacingCm;
    if (spacing <= 0) continue;

    // How many fit in width and height
    const fitsW = Math.floor(bedWidthCm / spacing);
    const fitsH = Math.floor(bedHeightCm / spacing);
    const fitCount = fitsW * fitsH;

    if (fitCount < 1) continue;

    // For containers, prefer compact plants
    if (isContainer && spacing > 50) continue;

    let reason = `${fitCount} plants at ${spacing}cm spacing`;
    if (plant.difficulty === 'easy') reason += ' · Easy';
    if (isContainer && plant.category === 'herb') reason += ' · Great in pots';
    if (isContainer && plant.id === 'tomato-cherry') reason += ' · Perfect for containers';

    suggestions.push({ plant, fitCount, reason });
  }

  // Sort: best fit first (more plants), then easy first
  return suggestions
    .sort((a, b) => {
      // Prioritise plants that fill the space well
      const aUtil = (a.fitCount * a.plant.spacingCm * a.plant.spacingCm) / bedAreaCm2;
      const bUtil = (b.fitCount * b.plant.spacingCm * b.plant.spacingCm) / bedAreaCm2;
      // Closer to 1.0 = better utilisation
      const aDiff = Math.abs(1 - aUtil);
      const bDiff = Math.abs(1 - bUtil);
      if (Math.abs(aDiff - bDiff) > 0.3) return aDiff - bDiff;
      // Then easy first
      const diffOrder = { easy: 0, moderate: 1, challenging: 2 };
      return (diffOrder[a.plant.difficulty || 'moderate'] || 1) - (diffOrder[b.plant.difficulty || 'moderate'] || 1);
    })
    .slice(0, 8);
}

/**
 * Given a plant, suggest ideal bed dimensions.
 */
export interface BedSizeSuggestion {
  label: string;
  widthCm: number;
  heightCm: number;
  plantCount: number;
  description: string;
}

export function suggestBedSizeForPlant(plant: Plant): BedSizeSuggestion[] {
  const s = plant.spacingCm;
  const suggestions: BedSizeSuggestion[] = [];

  // Small bed (2-4 plants)
  suggestions.push({
    label: 'Small',
    widthCm: s * 2,
    heightCm: s,
    plantCount: 2,
    description: `${s * 2}×${s}cm — 2 plants`,
  });

  // Medium bed (6-9 plants)
  const mW = s * 3;
  const mH = s * 2;
  suggestions.push({
    label: 'Medium',
    widthCm: mW,
    heightCm: mH,
    plantCount: 6,
    description: `${mW}×${mH}cm — 6 plants`,
  });

  // Large bed (12-16 plants)
  const lW = s * 4;
  const lH = s * 3;
  suggestions.push({
    label: 'Large',
    widthCm: lW,
    heightCm: lH,
    plantCount: 12,
    description: `${lW}×${lH}cm — 12 plants`,
  });

  // Row/border (1 row of plants)
  suggestions.push({
    label: 'Row',
    widthCm: s * 6,
    heightCm: s,
    plantCount: 6,
    description: `${s * 6}×${s}cm row — 6 plants`,
  });

  return suggestions;
}

/**
 * Generate succession planting task descriptions for placed plants
 */
export interface SuccessionTask {
  plantName: string;
  plantEmoji: string;
  harvestPeriod: string;
  suggestions: SuccessionSuggestion[];
}

export function getSuccessionTasks(placedPlantIds: string[]): SuccessionTask[] {
  const uniqueIds = [...new Set(placedPlantIds)];
  const tasks: SuccessionTask[] = [];

  for (const id of uniqueIds) {
    const suggestions = getSuccessionSuggestions(id);
    if (suggestions.length === 0) continue;

    const plant = allPlants.find(p => p.id === id);
    if (!plant || !plant.harvest) continue;

    tasks.push({
      plantName: plant.name,
      plantEmoji: plant.emoji,
      harvestPeriod: plant.harvest,
      suggestions: suggestions.slice(0, 3),
    });
  }

  return tasks;
}
