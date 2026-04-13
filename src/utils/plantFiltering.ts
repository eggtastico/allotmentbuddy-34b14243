/**
 * Plant Filtering and Processing Utility
 * Extracted filtering logic from PlantSidebar component
 */

import { Plant } from '@/types/garden';
import { plants as allPlants } from '@/data/plants';

/**
 * Filter plants by search term
 */
export function filterPlantsBySearch(plants: Plant[], searchTerm: string): Plant[] {
  if (!searchTerm.trim()) return plants;

  const term = searchTerm.toLowerCase();
  return plants.filter(p =>
    p.name.toLowerCase().includes(term) ||
    p.variety?.toLowerCase().includes(term) ||
    p.family?.toLowerCase().includes(term)
  );
}

/**
 * Filter plants by difficulty level
 */
export function filterPlantsByDifficulty(
  plants: Plant[],
  difficulty: 'all' | 'easy' | 'moderate' | 'challenging'
): Plant[] {
  if (difficulty === 'all') return plants;
  return plants.filter(p => p.difficulty === difficulty);
}

/**
 * Filter plants by sun preference
 */
export function filterPlantsBySun(
  plants: Plant[],
  sunPreference: 'all' | 'full-sun' | 'partial-shade' | 'full-shade' | 'any'
): Plant[] {
  if (sunPreference === 'all') return plants;
  return plants.filter(p => {
    if (!p.sunPreference) return false;
    if (sunPreference === 'any') return p.sunPreference === 'any';
    return p.sunPreference === sunPreference;
  });
}

/**
 * Group plants by category
 */
export function groupPlantsByCategory(plants: Plant[]) {
  const groups = new Map<string, Plant[]>();

  for (const plant of plants) {
    const category = plant.category;
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category)!.push(plant);
  }

  return groups;
}

/**
 * Group plants by family
 */
export function groupPlantsByFamily(plants: Plant[]) {
  const groups = new Map<string, Plant[]>();

  for (const plant of plants) {
    const family = plant.family || 'Unknown';
    if (!groups.has(family)) {
      groups.set(family, []);
    }
    groups.get(family)!.push(plant);
  }

  return groups;
}

/**
 * Apply multiple filters to plants
 */
export function applyPlantFilters(
  plants: Plant[],
  searchTerm: string,
  difficulty: 'all' | 'easy' | 'moderate' | 'challenging',
  sunPreference: 'all' | 'full-sun' | 'partial-shade' | 'full-shade' | 'any'
): Plant[] {
  let filtered = plants;
  filtered = filterPlantsBySearch(filtered, searchTerm);
  filtered = filterPlantsByDifficulty(filtered, difficulty);
  filtered = filterPlantsBySun(filtered, sunPreference);
  return filtered;
}

/**
 * Get all plants in a category
 */
export function getPlantsInCategory(category: Plant['category']): Plant[] {
  return allPlants.filter(p => p.category === category);
}

/**
 * Suggest bed size for a plant
 */
export function suggestBedSize(plant: Plant) {
  const spacing = plant.spacingCm;
  // Suggest a bed where plants fit comfortably with spacing
  const plantsPerRow = Math.max(2, Math.floor(100 / spacing)); // Assume 100cm wide bed
  return {
    width: 100,
    height: Math.ceil(spacing * 1.5),
    plantsPerRow,
  };
}
