/**
 * Garden Grid Calculations Utility
 * Extracted calculation logic from GardenGrid component for better testability and reusability
 */

import { PlacedPlant, PlotSettings, PlacedStructure } from '@/types/garden';
import { getPlantById } from '@/data/plants';
import { calculateShadeZones } from '@/utils/sunCalculator';
import { getCompanionReason } from '@/data/companionReasons';

/**
 * Calculate grid dimensions based on settings
 */
export function calculateGridDimensions(settings: PlotSettings) {
  const cellSize = settings.cellSizePx;
  const cellsPerUnit = settings.unit === 'meters' ? (100 / settings.cellSizeCm) : (30.48 / settings.cellSizeCm);
  const cols = Math.round(settings.widthM * cellsPerUnit);
  const rows = Math.round(settings.heightM * cellsPerUnit);
  const gridW = cols * cellSize;
  const gridH = rows * cellSize;

  return { cols, rows, gridW, gridH, cellSize };
}

/**
 * Build companion/enemy relationship map for plants
 */
export function buildCompanionMap(plants: PlacedPlant[]) {
  const map = new Map<string, {
    hasCompanion: boolean;
    hasEnemy: boolean;
    companionNames: string[];
    enemyNames: string[];
    reasons: string[];
  }>();

  const radius = 3;
  for (const p of plants) {
    const pData = getPlantById(p.plantId);
    if (!pData) continue;

    let hasCompanion = false;
    let hasEnemy = false;
    const companionNames: string[] = [];
    const enemyNames: string[] = [];
    const reasons: string[] = [];

    for (const other of plants) {
      if (other.id === p.id) continue;
      const dist = Math.abs(other.x - p.x) + Math.abs(other.y - p.y);
      if (dist > radius) continue;

      const oData = getPlantById(other.plantId);
      if (!oData) continue;

      // Check companions
      if (pData.companions.includes(other.plantId) || oData.companions.includes(p.plantId)) {
        hasCompanion = true;
        if (!companionNames.includes(oData.name)) companionNames.push(oData.name);
        const reason = getCompanionReason(p.plantId, other.plantId);
        if (reason && !reasons.includes(reason)) reasons.push(reason);
      }

      // Check enemies
      if (pData.enemies.includes(other.plantId) || oData.enemies.includes(p.plantId)) {
        hasEnemy = true;
        if (!enemyNames.includes(oData.name)) enemyNames.push(oData.name);
      }
    }

    map.set(p.id, { hasCompanion, hasEnemy, companionNames, enemyNames, reasons });
  }

  return map;
}

/**
 * Detect spacing conflicts between plants
 */
export function detectSpacingConflicts(plants: PlacedPlant[], settings: PlotSettings) {
  const conflicts = new Map<string, string[]>();

  for (const p of plants) {
    const pData = getPlantById(p.plantId);
    if (!pData) continue;

    const spacingCells = Math.ceil(pData.spacingCm / settings.cellSizeCm);
    const issues: string[] = [];

    for (const other of plants) {
      if (other.id === p.id || other.plantId !== p.plantId) continue;

      const dist = Math.sqrt(Math.pow(other.x - p.x, 2) + Math.pow(other.y - p.y, 2));
      if (dist > 0 && dist < spacingCells) {
        const actualCm = Math.round(dist * settings.cellSizeCm);
        issues.push(`Too close to another ${pData.name} (${actualCm}cm, needs ${pData.spacingCm}cm)`);
      }
    }

    conflicts.set(p.id, issues);
  }

  return conflicts;
}

/**
 * Determine sun exposure for a cell
 */
export function determineCellSunExposure(
  x: number,
  y: number,
  structures: PlacedStructure[],
  settings: PlotSettings,
  cols: number,
  rows: number
) {
  const shadeZones = calculateShadeZones(structures, settings, cols, rows);
  if (shadeZones.has(`${x},${y}`)) return 'shade';
  return 'sun';
}

/**
 * Check if a plant is occupying a cell
 */
export function getCellOccupant(x: number, y: number, plants: PlacedPlant[]): PlacedPlant | undefined {
  return plants.find(p => p.x === x && p.y === y);
}

/**
 * Find all occupied cells
 */
export function getOccupiedCells(plants: PlacedPlant[]): Set<string> {
  return new Set(plants.map(p => `${p.x},${p.y}`));
}
