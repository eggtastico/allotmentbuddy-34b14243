/**
 * Garden Compute Worker — runs companion/spacing/bucket calculations off the main thread.
 *
 * Receives: { plants, cellSizeCm, cols, rows }
 * Replies:  { companionMap, spacingConflicts, spatialBuckets, occupiedCells }
 *           occupiedCells.buffer is in the transfer list for zero-copy delivery.
 */

import { getPlantById } from '@/data/plants';
import { getCompanionReason } from '@/data/companionReasons';
import type { PlacedPlant } from '@/types/garden';

export type ComputeRequest = {
  type: 'compute';
  plants: PlacedPlant[];
  cellSizeCm: number;
  cols: number;
  rows: number;
};

export type CompanionInfo = {
  hasCompanion: boolean;
  hasEnemy: boolean;
  companionNames: string[];
  enemyNames: string[];
  reasons: string[];
};

export type ComputeResult = {
  type: 'result';
  companionMap: [string, CompanionInfo][];
  spacingConflicts: [string, string[]][];
  spatialBuckets: [string, PlacedPlant[]][];
  occupiedCells: Uint8Array;
};

self.onmessage = (e: MessageEvent<ComputeRequest>) => {
  if (e.data.type !== 'compute') return;
  const { plants, cellSizeCm, cols, rows } = e.data;

  // ── Companion map ──────────────────────────────────────────────────────────
  const companionMap = new Map<string, CompanionInfo>();
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
    companionMap.set(p.id, { hasCompanion, hasEnemy, companionNames, enemyNames, reasons });
  }

  // ── Spacing conflicts ──────────────────────────────────────────────────────
  const spacingConflicts = new Map<string, string[]>();
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
    if (issues.length > 0) spacingConflicts.set(p.id, issues);
  }

  // ── Spatial buckets ────────────────────────────────────────────────────────
  const BUCKET = 6;
  const spatialBuckets = new Map<string, PlacedPlant[]>();
  for (const p of plants) {
    const bx = Math.floor(p.x / BUCKET);
    const by = Math.floor(p.y / BUCKET);
    const key = `${bx},${by}`;
    if (!spatialBuckets.has(key)) spatialBuckets.set(key, []);
    spatialBuckets.get(key)!.push(p);
  }

  // ── Occupied cells (Uint8Array — transfer buffer for zero-copy) ────────────
  const occupiedCells = new Uint8Array(cols * rows);
  for (const p of plants) {
    const ax = Math.floor(p.x), ay = Math.floor(p.y);
    const aw = p.areaW ?? 1, ah = p.areaH ?? 1;
    for (let dy = 0; dy < ah; dy++) {
      for (let dx = 0; dx < aw; dx++) {
        const cx = ax + dx, cy = ay + dy;
        if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) occupiedCells[cy * cols + cx] = 1;
      }
    }
  }

  const result: ComputeResult = {
    type: 'result',
    companionMap: [...companionMap.entries()],
    spacingConflicts: [...spacingConflicts.entries()],
    spatialBuckets: [...spatialBuckets.entries()],
    occupiedCells,
  };

  // Transfer occupiedCells.buffer so the main thread receives it without copying.
  (self as unknown as Worker).postMessage(result, [occupiedCells.buffer]);
};
