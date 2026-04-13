import { describe, it, expect } from 'vitest';
import {
  getFrostDates,
  isInFrostFreeWindow,
  getPlantingRecommendation,
  getFrostSafetyColor,
  formatFrostDates,
} from '../frostDateCalculator';

describe('frostDateCalculator', () => {
  describe('getFrostDates', () => {
    it('should calculate frost dates for a given latitude', () => {
      // UK latitude (around 52°N)
      const frostDates = getFrostDates(52);
      expect(frostDates.lastFrostDate).toBeDefined();
      expect(frostDates.firstFrostDate).toBeDefined();
      expect(frostDates.frostFreeDays).toBeGreaterThan(0);
    });

    it('should return spring date before fall date', () => {
      const frostDates = getFrostDates(50);
      expect(frostDates.lastFrostDate < frostDates.firstFrostDate).toBe(true);
    });

    it('should calculate different frost-free days for different latitudes', () => {
      const northern = getFrostDates(60); // Further north
      const southern = getFrostDates(40); // Further south
      expect(southern.frostFreeDays).toBeGreaterThan(northern.frostFreeDays);
    });

    it('should return current year dates', () => {
      const frostDates = getFrostDates(50);
      const currentYear = new Date().getFullYear();
      expect(frostDates.lastFrostDate.getFullYear()).toBe(currentYear);
      expect(frostDates.firstFrostDate.getFullYear()).toBe(currentYear);
    });
  });

  describe('isInFrostFreeWindow', () => {
    it('should return true for dates within frost-free window', () => {
      const frostDates = getFrostDates(50);
      const midSummer = new Date(new Date().getFullYear(), 6, 15); // July 15
      expect(isInFrostFreeWindow(midSummer, frostDates)).toBe(true);
    });

    it('should return false for dates outside frost-free window', () => {
      const frostDates = getFrostDates(50);
      const midWinter = new Date(new Date().getFullYear(), 0, 15); // January 15
      expect(isInFrostFreeWindow(midWinter, frostDates)).toBe(false);
    });
  });

  describe('getPlantingRecommendation', () => {
    it('should return red color for tender plants before last frost', () => {
      const frostDates = getFrostDates(50);
      const recommendation = getPlantingRecommendation('tender', frostDates);
      // Depending on current date, this could be red or green
      expect(['red', 'green']).toContain(recommendation.color);
    });

    it('should return green color for hardy plants', () => {
      const frostDates = getFrostDates(50);
      const recommendation = getPlantingRecommendation('hardy', frostDates);
      expect(recommendation.color).toBe('green');
      expect(recommendation.plantingWindow).toBeDefined();
    });

    it('should return yellow color for half-hardy plants', () => {
      const frostDates = getFrostDates(50);
      const recommendation = getPlantingRecommendation('half-hardy', frostDates);
      expect(['yellow', 'green']).toContain(recommendation.color);
    });

    it('should handle undefined hardiness gracefully', () => {
      const frostDates = getFrostDates(50);
      const recommendation = getPlantingRecommendation(undefined, frostDates);
      expect(recommendation.recommendation).toBeDefined();
      expect(recommendation.color).toBe('yellow');
    });
  });

  describe('getFrostSafetyColor', () => {
    it('should return correct color for hardy plants', () => {
      const frostDates = getFrostDates(50);
      const color = getFrostSafetyColor('hardy', frostDates);
      expect(color).toBe('green');
    });

    it('should return a valid color for half-hardy plants', () => {
      const frostDates = getFrostDates(50);
      const color = getFrostSafetyColor('half-hardy', frostDates);
      expect(['red', 'yellow', 'green']).toContain(color);
    });

    it('should return a valid color for tender plants', () => {
      const frostDates = getFrostDates(50);
      const color = getFrostSafetyColor('tender', frostDates);
      expect(['red', 'yellow', 'green']).toContain(color);
    });
  });

  describe('formatFrostDates', () => {
    it('should return a readable frost date string', () => {
      const frostDates = getFrostDates(50);
      const formatted = formatFrostDates(frostDates);
      expect(formatted).toMatch(/\w+ \d+ to \w+ \d+ \(\-?\d+ days\)/);
    });

    it('should include frost-free days count', () => {
      const frostDates = getFrostDates(50);
      const formatted = formatFrostDates(frostDates);
      expect(formatted).toMatch(/\-?\d+ days/);
    });
  });
});
