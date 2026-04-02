import { PlacedPlant } from '@/types/garden';
import { getPlantById, rotationGroupLabels } from '@/data/plants';

/**
 * Rotation groups that participate in the classic 4-year rotation cycle.
 * "other" plants (perennials, flowers, herbs) stay in place.
 */
const ROTATION_CYCLE = ['legumes', 'brassicas', 'roots', 'solanaceae'] as const;
const SECONDARY_GROUPS = ['alliums', 'cucurbits', 'leafy'] as const;

interface Zone { group: string; cells: { x: number; y: number }[] }

/**
 * Optimise crop rotation by spatially clustering plants of the same
 * rotation group together and ensuring enemy plants are separated.
 *
 * Strategy:
 * 1. Identify which rotation groups are present
 * 2. Divide the occupied grid area into horizontal bands (zones)
 * 3. Assign each rotation group to a zone
 * 4. Re-place plants into their group's zone, preserving count
 * 5. "other" group plants stay in-place (perennials, herbs, flowers)
 */
export function optimizeRotation(plants: PlacedPlant[], gridCols: number, gridRows: number): PlacedPlant[] {
  if (plants.length === 0) return plants;

  // Separate "static" plants (other group — perennials/herbs/flowers) from rotatable
  const staticPlants: PlacedPlant[] = [];
  const rotatablePlants: PlacedPlant[] = [];

  plants.forEach(p => {
    const data = getPlantById(p.plantId);
    if (!data || data.rotationGroup === 'other') {
      staticPlants.push(p);
    } else {
      rotatablePlants.push(p);
    }
  });

  if (rotatablePlants.length === 0) return plants;

  // Collect occupied cells by static plants
  const staticCells = new Set(staticPlants.map(p => `${p.x},${p.y}`));

  // Get unique rotation groups present (in priority order)
  const groupOrder = [...ROTATION_CYCLE, ...SECONDARY_GROUPS];
  const groupsPresent = groupOrder.filter(g =>
    rotatablePlants.some(p => getPlantById(p.plantId)?.rotationGroup === g)
  );

  // Count plants per group
  const groupPlants: Record<string, PlacedPlant[]> = {};
  rotatablePlants.forEach(p => {
    const group = getPlantById(p.plantId)?.rotationGroup || 'other';
    if (!groupPlants[group]) groupPlants[group] = [];
    groupPlants[group].push(p);
  });

  // Calculate available cells (not occupied by static plants)
  const availableCells: { x: number; y: number }[] = [];
  for (let y = 0; y < gridRows; y++) {
    for (let x = 0; x < gridCols; x++) {
      if (!staticCells.has(`${x},${y}`)) {
        availableCells.push({ x, y });
      }
    }
  }

  // Divide available cells into zones (horizontal bands) for each group
  const zones: Zone[] = [];
  let cellIndex = 0;

  groupsPresent.forEach(group => {
    const count = groupPlants[group]?.length || 0;
    const zoneCells = availableCells.slice(cellIndex, cellIndex + count);
    zones.push({ group, cells: zoneCells });
    cellIndex += count;
  });

  // Re-place plants into their assigned zone cells
  const newPlants: PlacedPlant[] = [...staticPlants];

  zones.forEach(zone => {
    const plantsInGroup = groupPlants[zone.group] || [];

    // Sort plants by enemy count (place plants with most enemies first for best spacing)
    const sorted = [...plantsInGroup].sort((a, b) => {
      const da = getPlantById(a.plantId);
      const db = getPlantById(b.plantId);
      return (db?.enemies.length || 0) - (da?.enemies.length || 0);
    });

    sorted.forEach((plant, i) => {
      if (i < zone.cells.length) {
        newPlants.push({
          ...plant,
          x: zone.cells[i].x,
          y: zone.cells[i].y,
        });
      } else {
        // Overflow: keep original position
        newPlants.push(plant);
      }
    });
  });

  return newPlants;
}

/**
 * Analyse the current garden for rotation issues.
 */
export function analyzeRotation(plants: PlacedPlant[]): {
  groupCounts: Record<string, number>;
  conflicts: { plant1: string; plant2: string; reason: string }[];
  score: number;
  suggestions: string[];
} {
  const groupCounts: Record<string, number> = {};
  const conflicts: { plant1: string; plant2: string; reason: string }[] = [];
  const suggestions: string[] = [];

  plants.forEach(p => {
    const data = getPlantById(p.plantId);
    if (!data) return;
    groupCounts[data.rotationGroup] = (groupCounts[data.rotationGroup] || 0) + 1;
  });

  // Check for adjacent enemies
  plants.forEach(p1 => {
    const d1 = getPlantById(p1.plantId);
    if (!d1) return;
    plants.forEach(p2 => {
      if (p1.id >= p2.id) return; // avoid duplicates
      const d2 = getPlantById(p2.plantId);
      if (!d2) return;
      const dist = Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
      if (dist <= 2) {
        if (d1.enemies.includes(p2.plantId)) {
          conflicts.push({ plant1: d1.name, plant2: d2.name, reason: `${d1.name} and ${d2.name} are enemies and too close` });
        }
        if (d2.enemies.includes(p1.plantId)) {
          conflicts.push({ plant1: d2.name, plant2: d1.name, reason: `${d2.name} and ${d1.name} are enemies and too close` });
        }
      }
    });
  });

  // Check if same rotation group plants are scattered
  const rotGroups = [...ROTATION_CYCLE, ...SECONDARY_GROUPS];
  rotGroups.forEach(group => {
    const inGroup = plants.filter(p => getPlantById(p.plantId)?.rotationGroup === group);
    if (inGroup.length < 2) return;
    const avgX = inGroup.reduce((s, p) => s + p.x, 0) / inGroup.length;
    const avgY = inGroup.reduce((s, p) => s + p.y, 0) / inGroup.length;
    const spread = inGroup.reduce((s, p) => s + Math.abs(p.x - avgX) + Math.abs(p.y - avgY), 0) / inGroup.length;
    if (spread > 5) {
      suggestions.push(`${rotationGroupLabels[group]} are scattered — group them for easier rotation next year`);
    }
  });

  // Score: 100 = perfect, lose points for conflicts and scattering
  const score = Math.max(0, 100 - conflicts.length * 15 - suggestions.length * 5);

  return { groupCounts, conflicts, score, suggestions };
}
