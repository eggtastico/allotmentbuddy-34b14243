import { describe, it, expect } from 'vitest';
import {
  filterPlantsBySearch,
  filterPlantsByDifficulty,
  filterPlantsBySun,
  groupPlantsByCategory,
  groupPlantsByFamily,
  applyPlantFilters,
} from '../plantFiltering';
import { plants as allPlants } from '@/data/plants';

describe('plantFiltering', () => {
  describe('filterPlantsBySearch', () => {
    it('should return all plants when search term is empty', () => {
      const result = filterPlantsBySearch(allPlants, '');
      expect(result.length).toBe(allPlants.length);
    });

    it('should filter by plant name', () => {
      const result = filterPlantsBySearch(allPlants, 'tomato');
      expect(result.length).toBeGreaterThan(0);
      expect(result.every(p => p.name.toLowerCase().includes('tomato'))).toBe(true);
    });

    it('should be case insensitive', () => {
      const result1 = filterPlantsBySearch(allPlants, 'Tomato');
      const result2 = filterPlantsBySearch(allPlants, 'tomato');
      expect(result1.length).toBe(result2.length);
    });
  });

  describe('filterPlantsByDifficulty', () => {
    it('should return all plants when difficulty is "all"', () => {
      const result = filterPlantsByDifficulty(allPlants, 'all');
      expect(result.length).toBe(allPlants.length);
    });

    it('should filter by easy difficulty', () => {
      const easyPlants = allPlants.filter(p => p.difficulty === 'easy');
      const result = filterPlantsByDifficulty(allPlants, 'easy');
      expect(result.length).toBe(easyPlants.length);
    });

    it('should only return plants with specified difficulty', () => {
      const result = filterPlantsByDifficulty(allPlants, 'challenging');
      expect(result.every(p => p.difficulty === 'challenging')).toBe(true);
    });
  });

  describe('filterPlantsBySun', () => {
    it('should return all plants when sun preference is "all"', () => {
      const result = filterPlantsBySun(allPlants, 'all');
      expect(result.length).toBe(allPlants.length);
    });

    it('should filter by sun preference', () => {
      const result = filterPlantsBySun(allPlants, 'full-sun');
      expect(result.every(p => p.sunPreference === 'full-sun')).toBe(true);
    });
  });

  describe('groupPlantsByCategory', () => {
    it('should group plants by category', () => {
      const result = groupPlantsByCategory(allPlants);
      expect(result.has('vegetable')).toBe(true);
      expect(result.has('fruit')).toBe(true);
    });

    it('should include all plants in groups', () => {
      const result = groupPlantsByCategory(allPlants);
      let total = 0;
      result.forEach(group => {
        total += group.length;
      });
      expect(total).toBe(allPlants.length);
    });
  });

  describe('groupPlantsByFamily', () => {
    it('should group plants by family', () => {
      const result = groupPlantsByFamily(allPlants);
      expect(result.size).toBeGreaterThan(0);
    });

    it('should create groups for all unique families', () => {
      const result = groupPlantsByFamily(allPlants);
      const uniqueFamilies = new Set(allPlants.map(p => p.family || 'Unknown'));
      expect(result.size).toBe(uniqueFamilies.size);
    });
  });

  describe('applyPlantFilters', () => {
    it('should apply all filters correctly', () => {
      const result = applyPlantFilters(allPlants, 'tomato', 'easy', 'full-sun');
      expect(result.every(p => p.name.toLowerCase().includes('tomato'))).toBe(true);
      expect(result.every(p => p.difficulty === 'easy')).toBe(true);
      expect(result.every(p => p.sunPreference === 'full-sun')).toBe(true);
    });

    it('should return empty array when no plants match all filters', () => {
      const result = applyPlantFilters(allPlants, 'nonexistent', 'easy', 'full-sun');
      expect(result.length).toBe(0);
    });
  });
});
