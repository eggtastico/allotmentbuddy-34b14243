import { describe, it, expect } from 'vitest';
import {
  PlotSettingsSchema,
  PlacedPlantSchema,
  GardenPlanRowSchema,
  FavouritePlantRowSchema,
  SeedItemSchema,
} from '../schemas';
import { z } from 'zod';

describe('Zod Schemas', () => {
  describe('PlotSettingsSchema', () => {
    it('should validate correct plot settings', () => {
      const valid = {
        widthM: 6,
        heightM: 4,
        unit: 'meters' as const,
        cellSizePx: 32,
        cellSizeCm: 20,
        southDirection: 180,
        snapToGrid: true,
      };

      const result = PlotSettingsSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject negative dimensions', () => {
      const invalid = {
        widthM: -6,
        heightM: 4,
        unit: 'meters' as const,
        cellSizePx: 32,
        cellSizeCm: 20,
        southDirection: 180,
      };

      const result = PlotSettingsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject invalid units', () => {
      const invalid = {
        widthM: 6,
        heightM: 4,
        unit: 'kilometers',
        cellSizePx: 32,
        cellSizeCm: 20,
        southDirection: 180,
      };

      const result = PlotSettingsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject south direction > 360', () => {
      const invalid = {
        widthM: 6,
        heightM: 4,
        unit: 'meters' as const,
        cellSizePx: 32,
        cellSizeCm: 20,
        southDirection: 400,
      };

      const result = PlotSettingsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('PlacedPlantSchema', () => {
    it('should validate correct placed plant', () => {
      const valid = {
        id: 'plant-1',
        plantId: 'tomato',
        x: 0,
        y: 0,
        plantedAt: new Date().toISOString(),
        stage: 'seed' as const,
      };

      const result = PlacedPlantSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject invalid plant stage', () => {
      const invalid = {
        id: 'plant-1',
        plantId: 'tomato',
        x: 0,
        y: 0,
        plantedAt: new Date().toISOString(),
        stage: 'flowering',
      };

      const result = PlacedPlantSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject invalid date format', () => {
      const invalid = {
        id: 'plant-1',
        plantId: 'tomato',
        x: 0,
        y: 0,
        plantedAt: '2024-01-01',
        stage: 'seed',
      };

      const result = PlacedPlantSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('FavouritePlantRowSchema', () => {
    it('should validate correct favourite plant row', () => {
      const valid = {
        user_id: 'user-123',
        plant_id: 'tomato',
        order: 0,
        quantity: 5,
      };

      const result = FavouritePlantRowSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject negative quantity', () => {
      const invalid = {
        user_id: 'user-123',
        plant_id: 'tomato',
        order: 0,
        quantity: -5,
      };

      const result = FavouritePlantRowSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('SeedItemSchema', () => {
    it('should validate complete seed item', () => {
      const valid = {
        id: 'seed-1',
        user_id: 'user-123',
        plant_name: 'Tomato',
        variety: 'Cherry',
        quantity: 10,
        purchased_date: '2024-01-01',
        expiry_date: '2025-01-01',
        notes: 'Store in cool place',
      };

      const result = SeedItemSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should allow optional fields', () => {
      const minimal = {
        id: 'seed-1',
        user_id: 'user-123',
        plant_name: 'Tomato',
        quantity: 10,
      };

      const result = SeedItemSchema.safeParse(minimal);
      expect(result.success).toBe(true);
    });

    it('should reject negative quantity', () => {
      const invalid = {
        id: 'seed-1',
        user_id: 'user-123',
        plant_name: 'Tomato',
        quantity: -10,
      };

      const result = SeedItemSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
