import { describe, it, expect } from 'vitest';
import { calculateShadeZones, getSunExposure } from '../sunCalculator';
import { PlacedStructure, PlotSettings } from '@/types/garden';

describe('sunCalculator', () => {
  const defaultSettings: PlotSettings = {
    widthM: 6,
    heightM: 4,
    unit: 'meters',
    cellSizePx: 32,
    cellSizeCm: 20,
    southDirection: 180, // South is at bottom
    snapToGrid: true,
  };

  describe('calculateShadeZones', () => {
    it('should return empty set for no structures', () => {
      const shaded = calculateShadeZones([], defaultSettings, 10, 10);
      expect(shaded.size).toBe(0);
    });

    it('should calculate shade zones for a structure', () => {
      const structures: PlacedStructure[] = [
        {
          id: 'shed-1',
          structureId: 'shed',
          x: 5,
          y: 2,
          widthCells: 2,
          heightCells: 2,
        },
      ];

      const shaded = calculateShadeZones(structures, defaultSettings, 10, 10);
      // Shed casts shadow northward (upward), should have shade cells
      expect(shaded.size).toBeGreaterThan(0);
    });

    it('should respect grid boundaries', () => {
      const structures: PlacedStructure[] = [
        {
          id: 'shed-edge',
          structureId: 'shed',
          x: 0,
          y: 0,
          widthCells: 2,
          heightCells: 2,
        },
      ];

      const shaded = calculateShadeZones(structures, defaultSettings, 5, 5);
      // All shade cells should be within grid bounds
      shaded.forEach(cell => {
        const [x, y] = cell.split(',').map(Number);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(5);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThan(5);
      });
    });

    it('should handle different south directions', () => {
      const structures: PlacedStructure[] = [
        {
          id: 'shed-center',
          structureId: 'shed',
          x: 5,
          y: 5,
          widthCells: 2,
          heightCells: 2,
        },
      ];

      const settingsSouthBottom = { ...defaultSettings, southDirection: 180 };
      const shaded1 = calculateShadeZones(structures, settingsSouthBottom, 15, 15);

      const settingsSouthRight = { ...defaultSettings, southDirection: 270 };
      const shaded2 = calculateShadeZones(structures, settingsSouthRight, 15, 15);

      // Different directions should produce different shade patterns
      expect(shaded1).not.toEqual(shaded2);
    });
  });

  describe('getSunExposure', () => {
    it('should classify full sun cells', () => {
      const shaded = new Set<string>();
      const exposure = getSunExposure(5, 5, shaded);
      expect(exposure).toBe('full-sun');
    });

    it('should classify shaded cells', () => {
      const shaded = new Set<string>(['4,4', '5,4', '6,4', '4,5', '5,5', '6,5', '4,6', '5,6', '6,6']);
      const exposure = getSunExposure(5, 5, shaded);
      expect(exposure).toBe('full-shade');
    });

    it('should classify partial shade cells', () => {
      const shaded = new Set<string>(['5,5']);
      const exposure = getSunExposure(5, 5, shaded);
      expect(exposure).toBe('partial-shade');
    });

    it('should handle edge cases at grid boundaries', () => {
      const shaded = new Set<string>();
      const exposure = getSunExposure(0, 0, shaded);
      expect(exposure).toBe('full-sun');
    });
  });
});
