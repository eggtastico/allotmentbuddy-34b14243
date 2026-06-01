import { describe, it, expect } from 'vitest';
import {
  buildCompanionMap,
  buildSpacingConflicts,
  buildSpatialBuckets,
} from '../gardenDataBuilders';
import type { PlacedPlant } from '@/types/garden';

/**
 * Characterization tests for the pure garden-data builders. These guard the
 * companion/enemy, spacing-conflict, and spatial-bucketing logic so the
 * upcoming GardenGrid refactor can't silently change their behaviour.
 *
 * The companion/spacing cases rely on stable seed-data relationships in
 * src/data/plants.ts (e.g. carrot↔onion are companions, beetroot↔bean are
 * enemies). If those domain facts ever change, these expectations update too.
 */

let seq = 0;
function plant(plantId: string, x: number, y: number): PlacedPlant {
  seq += 1;
  return {
    id: `p${seq}`,
    plantId,
    x,
    y,
    plantedAt: '2026-01-01T00:00:00.000Z',
    stage: 'seed',
  };
}

describe('buildSpatialBuckets', () => {
  it('returns an empty map for no plants', () => {
    expect(buildSpatialBuckets([]).size).toBe(0);
  });

  it('groups plants within the same 6×6 bucket together', () => {
    // floor(5/6) === 0 for both coords, so (0,0) and (5,5) share bucket "0,0"
    const a = plant('carrot', 0, 0);
    const b = plant('carrot', 5, 5);
    const buckets = buildSpatialBuckets([a, b]);
    expect(buckets.size).toBe(1);
    expect(buckets.get('0,0')).toHaveLength(2);
  });

  it('separates plants across bucket boundaries (x=6 → bucket 1)', () => {
    const a = plant('carrot', 5, 0); // bucket 0,0
    const b = plant('carrot', 6, 0); // bucket 1,0
    const buckets = buildSpatialBuckets([a, b]);
    expect(buckets.size).toBe(2);
    expect(buckets.get('0,0')).toHaveLength(1);
    expect(buckets.get('1,0')).toHaveLength(1);
  });
});

describe('buildCompanionMap', () => {
  it('flags companions within radius (carrot next to onion)', () => {
    const carrot = plant('carrot', 0, 0);
    const onion = plant('onion', 1, 0);
    const map = buildCompanionMap([carrot, onion]);
    const entry = map.get(carrot.id)!;
    expect(entry.hasCompanion).toBe(true);
    expect(entry.companionNames).toContain('Onion');
  });

  it('flags enemies within radius (beetroot next to bean)', () => {
    const beetroot = plant('beetroot', 0, 0);
    const bean = plant('bean', 1, 0);
    const map = buildCompanionMap([beetroot, bean]);
    const entry = map.get(beetroot.id)!;
    expect(entry.hasEnemy).toBe(true);
    expect(entry.enemyNames).toContain('French Bean');
  });

  it('does not flag relationships beyond the radius of 3', () => {
    const carrot = plant('carrot', 0, 0);
    const onion = plant('onion', 0, 10); // Manhattan distance 10 > 3
    const map = buildCompanionMap([carrot, onion]);
    expect(map.get(carrot.id)!.hasCompanion).toBe(false);
  });

  it('skips plants with an unknown plantId', () => {
    const known = plant('carrot', 0, 0);
    const unknown = plant('not-a-real-plant', 1, 0);
    const map = buildCompanionMap([known, unknown]);
    expect(map.has(unknown.id)).toBe(false);
    expect(map.has(known.id)).toBe(true);
  });
});

describe('buildSpacingConflicts', () => {
  it('reports a conflict when same-type plants are closer than their spacing', () => {
    // tomato spacingCm 60, cellSizeCm 30 → spacingCells = ceil(60/30) = 2.
    // Distance of 1 cell (< 2) is a conflict.
    const a = plant('tomato', 0, 0);
    const b = plant('tomato', 1, 0);
    const conflicts = buildSpacingConflicts([a, b], 30);
    expect(conflicts.has(a.id)).toBe(true);
    expect(conflicts.has(b.id)).toBe(true);
    expect(conflicts.get(a.id)![0]).toMatch(/Too close/);
  });

  it('reports no conflict when same-type plants are adequately spaced', () => {
    const a = plant('tomato', 0, 0);
    const b = plant('tomato', 5, 0); // distance 5 ≥ spacingCells 2
    const conflicts = buildSpacingConflicts([a, b], 30);
    expect(conflicts.size).toBe(0);
  });

  it('only compares plants of the same type', () => {
    const tomato = plant('tomato', 0, 0);
    const carrot = plant('carrot', 1, 0); // different plantId → ignored
    const conflicts = buildSpacingConflicts([tomato, carrot], 30);
    expect(conflicts.size).toBe(0);
  });
});
