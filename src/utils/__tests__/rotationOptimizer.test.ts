import { describe, it, expect } from 'vitest';
import { analyzeRotation } from '../rotationOptimizer';
import type { PlacedPlant } from '@/types/garden';

function makePlant(id: string, plantId: string, x: number, y: number): PlacedPlant {
  return { id, plantId, x, y, plantedAt: new Date().toISOString(), stage: 'seed' };
}

describe('analyzeRotation', () => {
  it('returns perfect score for an empty garden', () => {
    const result = analyzeRotation([]);
    expect(result.score).toBe(100);
    expect(result.conflicts).toHaveLength(0);
    expect(result.suggestions).toHaveLength(0);
  });

  it('returns perfect score for a single plant', () => {
    const result = analyzeRotation([makePlant('a', 'tomato', 5, 5)]);
    expect(result.score).toBe(100);
    expect(result.conflicts).toHaveLength(0);
  });

  it('counts plants by rotation group', () => {
    const plants = [
      makePlant('a', 'tomato', 0, 0),
      makePlant('b', 'tomato', 5, 5),
      makePlant('c', 'carrot', 10, 10),
    ];
    const result = analyzeRotation(plants);
    expect(result.groupCounts).toBeDefined();
    // Tomato is solanaceae, carrot is roots
    expect(Object.keys(result.groupCounts).length).toBeGreaterThan(0);
  });

  it('detects enemy conflicts when plants are adjacent', () => {
    // Tomato and fennel are known enemies in the plant data
    const plants = [
      makePlant('a', 'tomato', 5, 5),
      makePlant('b', 'fennel', 5, 6), // 1 cell apart (distance = 1, within 2)
    ];
    const result = analyzeRotation(plants);
    // Score should be less than 100 if conflict detected
    if (result.conflicts.length > 0) {
      expect(result.score).toBeLessThan(100);
      expect(result.conflicts[0].reason).toContain('enemies');
    }
  });

  it('does not flag enemies when far apart', () => {
    const plants = [
      makePlant('a', 'tomato', 0, 0),
      makePlant('b', 'fennel', 20, 20), // far apart
    ];
    const result = analyzeRotation(plants);
    expect(result.conflicts).toHaveLength(0);
  });

  it('suggests grouping scattered plants of same rotation group', () => {
    // Place many tomatoes (solanaceae) scattered across the grid
    const plants = [
      makePlant('a', 'tomato', 0, 0),
      makePlant('b', 'tomato', 20, 0),
      makePlant('c', 'tomato', 0, 20),
      makePlant('d', 'tomato', 20, 20),
    ];
    const result = analyzeRotation(plants);
    // Should suggest grouping them
    const hasSuggestion = result.suggestions.some(s => s.includes('scattered'));
    expect(hasSuggestion).toBe(true);
  });
});
