/**
 * Companion Planting Heatmap Generator
 * Computes influence scores for empty grid cells based on companion/enemy relationships
 * with placed plants, to guide optimal placement when dragging a plant.
 */

import { PlacedPlant } from '@/types/garden';
import { getPlantById } from '@/data/plants';

export interface CompanionHeatmap {
  companion: Float32Array;
  enemy: Float32Array;
}

/**
 * Build a companion/enemy influence heatmap for a plant being dragged/placed.
 *
 * Returns two Float32Arrays (cols × rows) with per-cell influence scores:
 * - companion: sum of inverse-distance weighted scores from companion plants
 * - enemy: sum of inverse-distance weighted scores from enemy plants
 *
 * Returns null if the active plant not found or no relevant placed plants.
 */
export function buildCompanionHeatmap(
  activePlantId: string,
  placedPlants: PlacedPlant[],
  cols: number,
  rows: number
): CompanionHeatmap | null {
  const activePlant = getPlantById(activePlantId);
  if (!activePlant) return null;

  const heatmap: CompanionHeatmap = {
    companion: new Float32Array(cols * rows),
    enemy: new Float32Array(cols * rows),
  };

  const RADIUS = 4;

  // For each placed plant, check if it's a companion or enemy
  for (const placed of placedPlants) {
    const placedData = getPlantById(placed.plantId);
    if (!placedData) continue;

    // Bidirectional check (matching the logic in GardenGrid line 1317-1318)
    const isCompanion =
      activePlant.companions.includes(placed.plantId) ||
      placedData.companions.includes(activePlantId);
    const isEnemy =
      activePlant.enemies.includes(placed.plantId) ||
      placedData.enemies.includes(activePlantId);

    if (!isCompanion && !isEnemy) continue;

    // Round to grid cells
    const px = Math.floor(placed.x);
    const py = Math.floor(placed.y);

    // Accumulate influence scores within radius using Manhattan distance
    // Inverse-distance weighting: closer cells get stronger scores
    for (let dx = -RADIUS; dx <= RADIUS; dx++) {
      for (let dy = -RADIUS; dy <= RADIUS; dy++) {
        const cx = px + dx;
        const cy = py + dy;

        // Skip cells outside grid
        if (cx < 0 || cx >= cols || cy < 0 || cy >= rows) continue;

        // Manhattan distance + 1 (to avoid division by zero)
        const dist = Math.abs(dx) + Math.abs(dy);
        const score = 1 / (dist + 1);

        const idx = cy * cols + cx;

        if (isCompanion) {
          heatmap.companion[idx] += score;
        }
        if (isEnemy) {
          heatmap.enemy[idx] += score;
        }
      }
    }
  }

  return heatmap;
}
