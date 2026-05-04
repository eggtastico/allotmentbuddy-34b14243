import { PlacedStructure, PlotSettings } from '@/types/garden';
import { getStructureById } from '@/data/structures';

// Set to true to enable detailed sun calculation logging
const DEBUG_SUN = false;

/**
 * Calculate which grid cells are in shade based on structures and the sun direction.
 * Sun comes from the south direction, so structures cast shadows in the opposite direction.
 * Returns a Set of "x,y" strings for shaded cells.
 */
export function calculateShadeZones(
  structures: PlacedStructure[],
  settings: PlotSettings,
  cols: number,
  rows: number,
): Set<string> {
  const shaded = new Set<string>();
  const southDeg = settings.southDirection;

  // Sun comes from south, so shadow is cast opposite to south (toward north)
  // Convert to grid direction: southDirection=180 means south is at bottom,
  // shadow goes upward (negative y)
  const shadowAngleRad = ((southDeg + 180) % 360) * (Math.PI / 180);
  const shadowDx = Math.round(Math.sin(shadowAngleRad));
  const shadowDy = -Math.round(Math.cos(shadowAngleRad)); // negative because y increases downward

  if (DEBUG_SUN) {
    console.log(`Shadow direction: angle=${shadowAngleRad.toFixed(2)} rad, dx=${shadowDx}, dy=${shadowDy}`);
  }

  let processedCount = 0;
  let skippedCount = 0;

  for (const struct of structures) {
    const data = getStructureById(struct.structureId);
    if (!data) {
      continue;
    }
    // Only structures that actually block sunlight should cast shadows:
    // - Sheds, fences (solid, tall structures)
    // - Greenhouses, polytunnels, cold frames (semi-transparent but still block significant light)
    // Skip: beds, containers, paths (ground-level, don't block sun)
    const shadowCastingStructures = ['shed', 'fence', 'greenhouse', 'polytunnel', 'cold-frame'];
    if (!shadowCastingStructures.includes(data.id)) {
      skippedCount++;
      continue;
    }
    processedCount++;

    let cellsFromThisStruct = 0;
    // For each cell of the structure, project shadow in shadow direction
    for (let dx = 0; dx < struct.widthCells; dx++) {
      for (let dy = 0; dy < struct.heightCells; dy++) {
        const baseX = struct.x + dx;
        const baseY = struct.y + dy;
        // Shadow extends ~3 cells from structure
        for (let dist = 1; dist <= 3; dist++) {
          const sx = baseX + shadowDx * dist;
          const sy = baseY + shadowDy * dist;
          if (sx >= 0 && sx < cols && sy >= 0 && sy < rows) {
            shaded.add(`${sx},${sy}`);
            cellsFromThisStruct++;
          }
        }
      }
    }
  }

  if (DEBUG_SUN) {
    console.log(`calculateShadeZones: ${shaded.size} shaded cells (${processedCount} structures, ${skippedCount} skipped)`);
  }
  return shaded;
}

/**
 * Determine if a cell position is in full sun, partial shade, or full shade.
 */
export function getSunExposure(
  x: number,
  y: number,
  shadeZones: Set<string>,
): 'full-sun' | 'partial-shade' | 'full-shade' {
  // Check surrounding cells for shade density
  let shadedNeighbors = 0;
  const checkRadius = 1;
  let total = 0;
  for (let dx = -checkRadius; dx <= checkRadius; dx++) {
    for (let dy = -checkRadius; dy <= checkRadius; dy++) {
      total++;
      if (shadeZones.has(`${x + dx},${y + dy}`)) {
        shadedNeighbors++;
      }
    }
  }

  if (shadedNeighbors >= total * 0.7) return 'full-shade';
  if (shadedNeighbors >= 1) return 'partial-shade';
  return 'full-sun';
}

export const sunExposureLabels: Record<string, string> = {
  'full-sun': '☀️ Full Sun',
  'partial-shade': '⛅ Partial Shade',
  'full-shade': '☁️ Full Shade',
};

export const sunExposureColors: Record<string, string> = {
  'full-sun': 'hsl(45 100% 60% / 0.15)',
  'partial-shade': 'hsl(200 60% 60% / 0.12)',
  'full-shade': 'hsl(220 20% 50% / 0.15)',
};
