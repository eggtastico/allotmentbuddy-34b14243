import { describe, it, expect } from 'vitest';
import { calculateGridDimensions, detectSpacingConflicts } from '../gardenGridCalculations';
import type { PlotSettings, PlacedPlant } from '@/types/garden';

const baseSettings: PlotSettings = {
  widthM: 6,
  heightM: 4,
  unit: 'meters',
  cellSizePx: 32,
  cellSizeCm: 20,
  southDirection: 180,
};

function makePlant(id: string, plantId: string, x: number, y: number): PlacedPlant {
  return { id, plantId, x, y, plantedAt: new Date().toISOString(), stage: 'seed' };
}

describe('calculateGridDimensions', () => {
  it('calculates correct grid size for meters', () => {
    const result = calculateGridDimensions(baseSettings);
    // 6m wide, 20cm cells = 600cm / 20cm = 30 cols
    expect(result.cols).toBe(30);
    // 4m high = 400cm / 20cm = 20 rows
    expect(result.rows).toBe(20);
    expect(result.cellSize).toBe(32);
    expect(result.gridW).toBe(30 * 32);
    expect(result.gridH).toBe(20 * 32);
  });

  it('calculates correct grid size for feet', () => {
    const feetSettings: PlotSettings = { ...baseSettings, unit: 'feet' };
    const result = calculateGridDimensions(feetSettings);
    // 6 feet = 182.88cm, /20cm = 9.144 → rounds to 9
    expect(result.cols).toBe(9);
    // 4 feet = 121.92cm, /20cm = 6.096 → rounds to 6
    expect(result.rows).toBe(6);
  });

  it('handles small plots', () => {
    const small: PlotSettings = { ...baseSettings, widthM: 1, heightM: 1 };
    const result = calculateGridDimensions(small);
    expect(result.cols).toBe(5); // 100cm / 20cm = 5
    expect(result.rows).toBe(5);
  });
});

describe('detectSpacingConflicts', () => {
  it('returns no conflicts when plants are far apart', () => {
    const plants = [
      makePlant('a', 'tomato', 0, 0),
      makePlant('b', 'tomato', 10, 10),
    ];
    const conflicts = detectSpacingConflicts(plants, baseSettings);
    const aIssues = conflicts.get('a') ?? [];
    const bIssues = conflicts.get('b') ?? [];
    expect(aIssues).toHaveLength(0);
    expect(bIssues).toHaveLength(0);
  });

  it('detects conflicts when same-type plants are too close', () => {
    // Tomatoes need 60cm spacing, with 20cm cells that's 3 cells
    const plants = [
      makePlant('a', 'tomato', 0, 0),
      makePlant('b', 'tomato', 1, 0), // 1 cell apart = 20cm, way under 60cm
    ];
    const conflicts = detectSpacingConflicts(plants, baseSettings);
    const aIssues = conflicts.get('a') ?? [];
    expect(aIssues.length).toBeGreaterThan(0);
    expect(aIssues[0]).toContain('Too close');
  });

  it('ignores different plant types', () => {
    // Different plants don't have spacing conflicts with each other
    const plants = [
      makePlant('a', 'tomato', 0, 0),
      makePlant('b', 'carrot', 1, 0),
    ];
    const conflicts = detectSpacingConflicts(plants, baseSettings);
    const aIssues = conflicts.get('a') ?? [];
    const bIssues = conflicts.get('b') ?? [];
    expect(aIssues).toHaveLength(0);
    expect(bIssues).toHaveLength(0);
  });

  it('returns empty issues for a single plant', () => {
    const plants = [makePlant('a', 'tomato', 5, 5)];
    const conflicts = detectSpacingConflicts(plants, baseSettings);
    expect(conflicts.get('a')).toHaveLength(0);
  });
});
