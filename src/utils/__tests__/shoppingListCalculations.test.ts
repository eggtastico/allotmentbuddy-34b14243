import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateShoppingList,
  groupByCategory,
  groupByRotation,
  groupBySowingMethod,
  sortByName,
  calculateStats,
} from '../shoppingListCalculations';
import { PlacedPlant } from '@/types/garden';

describe('shoppingListCalculations', () => {
  describe('generateShoppingList', () => {
    it('should generate empty list for empty plants', () => {
      const result = generateShoppingList([]);
      expect(result).toEqual([]);
    });

    it('should generate shopping items for placed plants', () => {
      const plants: PlacedPlant[] = [
        {
          id: '1',
          plantId: 'tomato-beefsteak',
          x: 0,
          y: 0,
          plantedAt: '2026-04-01',
          stage: 'seedling',
        },
      ];

      const result = generateShoppingList(plants);
      expect(result.length).toBe(1);
      expect(result[0].plantName).toBe('Beefsteak Tomato');
      expect(result[0].checked).toBe(false);
    });

    it('should count multiple instances of same plant', () => {
      const plants: PlacedPlant[] = [
        { id: '1', plantId: 'tomato-beefsteak', x: 0, y: 0, plantedAt: '2026-04-01', stage: 'seedling' },
        { id: '2', plantId: 'tomato-beefsteak', x: 1, y: 0, plantedAt: '2026-04-01', stage: 'seedling' },
        { id: '3', plantId: 'tomato-beefsteak', x: 2, y: 0, plantedAt: '2026-04-01', stage: 'seedling' },
      ];

      const result = generateShoppingList(plants);
      expect(result.length).toBe(1);
      expect(result[0].quantity).toBe(3);
    });

    it('should handle multiple different plants', () => {
      const plants: PlacedPlant[] = [
        { id: '1', plantId: 'tomato-beefsteak', x: 0, y: 0, plantedAt: '2026-04-01', stage: 'seedling' },
        { id: '2', plantId: 'lettuce', x: 1, y: 0, plantedAt: '2026-04-01', stage: 'seed' },
      ];

      const result = generateShoppingList(plants);
      expect(result.length).toBe(2);
      expect(result.map(r => r.plantName)).toContain('Beefsteak Tomato');
      expect(result.map(r => r.plantName)).toContain('Lettuce');
    });
  });

  describe('groupByCategory', () => {
    it('should group items by plant category', () => {
      const plants: PlacedPlant[] = [
        { id: '1', plantId: 'tomato-beefsteak', x: 0, y: 0, plantedAt: '2026-04-01', stage: 'seedling' },
        { id: '2', plantId: 'lettuce', x: 1, y: 0, plantedAt: '2026-04-01', stage: 'seed' },
        { id: '3', plantId: 'strawberry', x: 2, y: 0, plantedAt: '2026-04-01', stage: 'seedling' },
      ];

      const items = generateShoppingList(plants);
      const grouped = groupByCategory(items);

      expect(grouped.has('vegetable')).toBe(true);
      expect(grouped.has('fruit')).toBe(true);
    });

    it('should include all items in groups', () => {
      const plants: PlacedPlant[] = [
        { id: '1', plantId: 'tomato-beefsteak', x: 0, y: 0, plantedAt: '2026-04-01', stage: 'seedling' },
        { id: '2', plantId: 'lettuce-buttercrunch', x: 1, y: 0, plantedAt: '2026-04-01', stage: 'seed' },
      ];

      const items = generateShoppingList(plants);
      const grouped = groupByCategory(items);

      let total = 0;
      grouped.forEach(group => {
        total += group.length;
      });

      expect(total).toBe(items.length);
    });
  });

  describe('groupByRotation', () => {
    it('should group items by rotation group', () => {
      const plants: PlacedPlant[] = [
        { id: '1', plantId: 'tomato-beefsteak', x: 0, y: 0, plantedAt: '2026-04-01', stage: 'seedling' },
        { id: '2', plantId: 'lettuce', x: 1, y: 0, plantedAt: '2026-04-01', stage: 'seed' },
      ];

      const items = generateShoppingList(plants);
      const grouped = groupByRotation(items);

      expect(grouped.size).toBeGreaterThan(0);
    });
  });

  describe('groupBySowingMethod', () => {
    it('should group items by sowing method', () => {
      const plants: PlacedPlant[] = [
        { id: '1', plantId: 'tomato-beefsteak', x: 0, y: 0, plantedAt: '2026-04-01', stage: 'seedling' },
        { id: '2', plantId: 'lettuce', x: 1, y: 0, plantedAt: '2026-04-01', stage: 'seed' },
      ];

      const items = generateShoppingList(plants);
      const grouped = groupBySowingMethod(items);

      expect(grouped.size).toBeGreaterThan(0);
    });

    it('should have indoors, outdoors, or both as keys', () => {
      const plants: PlacedPlant[] = [
        { id: '1', plantId: 'tomato-beefsteak', x: 0, y: 0, plantedAt: '2026-04-01', stage: 'seedling' },
      ];

      const items = generateShoppingList(plants);
      const grouped = groupBySowingMethod(items);

      for (const key of grouped.keys()) {
        expect(['indoors', 'outdoors', 'both']).toContain(key);
      }
    });
  });

  describe('sortByName', () => {
    it('should sort items alphabetically by plant name', () => {
      const plants: PlacedPlant[] = [
        { id: '1', plantId: 'tomato-beefsteak', x: 0, y: 0, plantedAt: '2026-04-01', stage: 'seedling' },
        { id: '2', plantId: 'lettuce', x: 1, y: 0, plantedAt: '2026-04-01', stage: 'seed' },
        { id: '3', plantId: 'carrot', x: 2, y: 0, plantedAt: '2026-04-01', stage: 'seed' },
      ];

      const items = generateShoppingList(plants);
      const sorted = sortByName(items);

      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i].plantName.localeCompare(sorted[i + 1].plantName)).toBeLessThanOrEqual(0);
      }
    });
  });

  describe('calculateStats', () => {
    it('should calculate correct stats', () => {
      const plants: PlacedPlant[] = [
        { id: '1', plantId: 'tomato-beefsteak', x: 0, y: 0, plantedAt: '2026-04-01', stage: 'seedling' },
        { id: '2', plantId: 'lettuce', x: 1, y: 0, plantedAt: '2026-04-01', stage: 'seed' },
      ];

      const items = generateShoppingList(plants);
      const stats = calculateStats(items);

      expect(stats.total).toBe(2);
      expect(stats.checked).toBe(0);
    });

    it('should count checked items', () => {
      const plants: PlacedPlant[] = [
        { id: '1', plantId: 'tomato-beefsteak', x: 0, y: 0, plantedAt: '2026-04-01', stage: 'seedling' },
        { id: '2', plantId: 'lettuce-buttercrunch', x: 1, y: 0, plantedAt: '2026-04-01', stage: 'seed' },
      ];

      const items = generateShoppingList(plants);
      items[0].checked = true;
      const stats = calculateStats(items);

      expect(stats.checked).toBe(1);
    });
  });
});
