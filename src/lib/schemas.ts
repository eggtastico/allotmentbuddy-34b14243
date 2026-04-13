import { z } from 'zod';
import { PlotSettings, PlacedPlant, PlacedStructure, PlantStage } from '@/types/garden';

// Base type schemas for validation
export const PlotSettingsSchema = z.object({
  widthM: z.number().positive(),
  heightM: z.number().positive(),
  unit: z.enum(['meters', 'feet']),
  cellSizePx: z.number().positive(),
  cellSizeCm: z.number().positive(),
  southDirection: z.number().min(0).max(360),
  snapToGrid: z.boolean().optional(),
}) satisfies z.ZodType<PlotSettings>;

export const PlacedPlantSchema = z.object({
  id: z.string(),
  plantId: z.string(),
  x: z.number(),
  y: z.number(),
  plantedAt: z.string().datetime(),
  stage: z.enum(['seed', 'seedling'] as const),
}) satisfies z.ZodType<PlacedPlant>;

export const PlacedStructureSchema = z.object({
  id: z.string(),
  structureId: z.string(),
  x: z.number(),
  y: z.number(),
  widthCells: z.number().positive(),
  heightCells: z.number().positive(),
}) satisfies z.ZodType<PlacedStructure>;

// Supabase response schemas
export const GardenPlanRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  plot_settings: z.record(z.unknown()).transform(v => v as PlotSettings),
  plants: z.array(z.unknown()).transform(v =>
    v.map((p: unknown) => {
      const plant = p as Record<string, unknown>;
      return {
        ...plant,
        plantedAt: (plant.plantedAt as string) || new Date().toISOString(),
        stage: (plant.stage as PlantStage) || ('seed' as PlantStage),
      };
    })
  ),
  beds: z.array(z.unknown()).transform(v =>
    v.map((s: unknown) => {
      const structure = s as Record<string, unknown>;
      return {
        id: (structure.id as string) || `struct-${Date.now()}`,
        structureId: (structure.structureId as string) || (structure.type as string) || 'raised-bed',
        x: (structure.x as number) ?? 0,
        y: (structure.y as number) ?? 0,
        widthCells: (structure.widthCells as number) ?? (structure.width as number) ?? 4,
        heightCells: (structure.heightCells as number) ?? (structure.height as number) ?? 2,
      };
    })
  ),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const GardenPlansResponseSchema = z.array(GardenPlanRowSchema);

// Favourite plants schema
export const FavouritePlantRowSchema = z.object({
  id: z.string().optional(),
  user_id: z.string(),
  plant_id: z.string(),
  order: z.number(),
  quantity: z.number().nonnegative(),
  created_at: z.string().optional(),
});

export const FavouritePlantsResponseSchema = z.array(FavouritePlantRowSchema);

// Seed inventory schema
export const SeedItemSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  plant_name: z.string(),
  variety: z.string().optional(),
  quantity: z.number().nonnegative(),
  purchased_date: z.string().nullable().optional(),
  expiry_date: z.string().nullable().optional(),
  notes: z.string().optional(),
  ai_extracted_data: z.record(z.unknown()).nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const SeedInventoryResponseSchema = z.array(SeedItemSchema);

// Garden tasks schema
export const TaskSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  completed: z.boolean().default(false),
  period: z.enum(['weekly', 'monthly']).optional(),
  due_date: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const TasksResponseSchema = z.array(TaskSchema);

// Error schema for type-safe error handling
export const AuthErrorSchema = z.object({
  message: z.string(),
  status: z.number().optional(),
});

export type GardenPlanRow = z.infer<typeof GardenPlanRowSchema>;
export type FavouritePlantRow = z.infer<typeof FavouritePlantRowSchema>;
export type SeedItem = z.infer<typeof SeedItemSchema>;
export type Task = z.infer<typeof TaskSchema>;
