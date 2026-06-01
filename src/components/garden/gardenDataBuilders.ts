/**
 * Standalone build functions for computed garden data.
 * Extracted from GardenGrid.tsx for testability and worker reuse.
 */
import { PlacedPlant } from '@/types/garden';
import { getPlantById } from '@/data/plants';
import { getCompanionReason } from '@/data/companionReasons';

export interface CompanionInfo {
  hasCompanion: boolean;
  hasEnemy: boolean;
  companionNames: string[];
  enemyNames: string[];
  reasons: string[];
}

export function buildCompanionMap(plants: PlacedPlant[]): Map<string, CompanionInfo> {
  const map = new Map<string, CompanionInfo>();
  const radius = 3;
  for (const p of plants) {
    const pData = getPlantById(p.plantId);
    if (!pData) continue;
    let hasCompanion = false, hasEnemy = false;
    const companionNames: string[] = [], enemyNames: string[] = [], reasons: string[] = [];
    for (const other of plants) {
      if (other.id === p.id) continue;
      const dist = Math.abs(other.x - p.x) + Math.abs(other.y - p.y);
      if (dist > radius) continue;
      const oData = getPlantById(other.plantId);
      if (!oData) continue;
      if (pData.companions.includes(other.plantId) || oData.companions.includes(p.plantId)) {
        hasCompanion = true;
        if (!companionNames.includes(oData.name)) companionNames.push(oData.name);
        const reason = getCompanionReason(p.plantId, other.plantId);
        if (reason && !reasons.includes(reason)) reasons.push(reason);
      }
      if (pData.enemies.includes(other.plantId) || oData.enemies.includes(p.plantId)) {
        hasEnemy = true;
        if (!enemyNames.includes(oData.name)) enemyNames.push(oData.name);
        const reason = getCompanionReason(p.plantId, other.plantId);
        if (reason && !reasons.includes(reason)) reasons.push(reason);
      }
    }
    map.set(p.id, { hasCompanion, hasEnemy, companionNames, enemyNames, reasons });
  }
  return map;
}

export function buildSpacingConflicts(plants: PlacedPlant[], cellSizeCm: number): Map<string, string[]> {
  const conflicts = new Map<string, string[]>();
  for (const p of plants) {
    const pData = getPlantById(p.plantId);
    if (!pData) continue;
    const spacingCells = Math.ceil(pData.spacingCm / cellSizeCm);
    const issues: string[] = [];
    for (const other of plants) {
      if (other.id === p.id || other.plantId !== p.plantId) continue;
      const dist = Math.sqrt(Math.pow(other.x - p.x, 2) + Math.pow(other.y - p.y, 2));
      if (dist > 0 && dist < spacingCells) {
        const actualCm = Math.round(dist * cellSizeCm);
        issues.push(`Too close to another ${pData.name} (${actualCm}cm, needs ${pData.spacingCm}cm)`);
      }
    }
    if (issues.length > 0) conflicts.set(p.id, issues);
  }
  return conflicts;
}

export function buildSpatialBuckets(plants: PlacedPlant[]): Map<string, PlacedPlant[]> {
  const BUCKET = 6;
  const buckets = new Map<string, PlacedPlant[]>();
  for (const p of plants) {
    const bx = Math.floor(p.x / BUCKET);
    const by = Math.floor(p.y / BUCKET);
    const key = `${bx},${by}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(p);
  }
  return buckets;
}
