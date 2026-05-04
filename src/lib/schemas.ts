import { z } from 'zod';
import { PlotSettings, PlacedPlant, PlacedStructure } from '@/types/garden';

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

export const PlantPhotoSchema = z.object({
  id: z.string(),
  dataUrl: z.string(),
  timestamp: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
});

export const PlacedPlantSchema = z.object({
  id: z.string(),
  plantId: z.string(),
  x: z.number(),
  y: z.number(),
  plantedAt: z.string().datetime(),
  stage: z.enum(['seed', 'seedling', 'established'] as const),
  photos: z.array(PlantPhotoSchema).optional(),
}) satisfies z.ZodType<PlacedPlant>;

export const PlacedStructureSchema = z.object({
  id: z.string(),
  structureId: z.string(),
  x: z.number(),
  y: z.number(),
  widthCells: z.number().positive(),
  heightCells: z.number().positive(),
}) satisfies z.ZodType<PlacedStructure>;

// Location data schema for validated location objects
export const LocationDataSchema = z.object({
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  region: z.string().optional(),
});

export type LocationData = z.infer<typeof LocationDataSchema>;

/**
 * Coerce a raw plant object from Supabase/IndexedDB into a valid PlacedPlant,
 * filling in defaults for missing fields.
 */
const RawPlantSchema = z.object({
  id: z.string(),
  plantId: z.string().default(''),
  x: z.number().default(0),
  y: z.number().default(0),
  plantedAt: z.string().default(() => new Date().toISOString()),
  stage: z.enum(['seed', 'seedling', 'established']).catch('seed'),
  photos: z.array(PlantPhotoSchema).optional(),
}).passthrough();

/**
 * Coerce a raw structure/bed object, handling legacy field names (type -> structureId,
 * width -> widthCells, height -> heightCells).
 */
const RawStructureSchema = z.object({
  id: z.string().default(() => `struct-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
  structureId: z.string().optional(),
  type: z.string().optional(),
  x: z.number().default(0),
  y: z.number().default(0),
  widthCells: z.number().optional(),
  heightCells: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
}).passthrough().transform((s): PlacedStructure => ({
  id: s.id,
  structureId: s.structureId || s.type || 'raised-bed',
  x: s.x,
  y: s.y,
  widthCells: s.widthCells ?? s.width ?? 4,
  heightCells: s.heightCells ?? s.height ?? 2,
}));

// Supabase response schemas
export const GardenPlanRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  plot_settings: PlotSettingsSchema,
  plants: z.array(RawPlantSchema).catch([]),
  beds: z.array(RawStructureSchema).catch([]),
  location: LocationDataSchema.nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const GardenPlansResponseSchema = z.array(GardenPlanRowSchema);

// Favourite plants schema (response from Supabase select)
export const FavouritePlantRowSchema = z.object({
  id: z.string().optional(),
  user_id: z.string().optional(),
  plant_id: z.string(),
  order: z.number(),
  quantity: z.number().nonnegative(),
  created_at: z.string().optional(),
});

export const FavouritePlantsResponseSchema = z.array(FavouritePlantRowSchema);

/**
 * Schema for validating local IndexedDB garden plans.
 * These have a slightly different shape (settings vs plot_settings, no user_id).
 */
export const LocalGardenPlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  settings: PlotSettingsSchema,
  plants: z.array(RawPlantSchema).catch([]),
  beds: z.array(RawStructureSchema).catch([]),
  location: LocationDataSchema.optional(),
});

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

// Harvest log schema
export const HarvestLogSchema = z.object({
  id: z.string(),
  gardenId: z.string(),
  plantId: z.string(),
  placedPlantId: z.string(),
  harvestDate: z.string(),
  quantityHarvested: z.number().nonnegative().optional(),
  weightGrams: z.number().nonnegative().optional(),
  qualityRating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  notes: z.string().optional(),
});

// Pest/disease log schema
export const PestLogSchema = z.object({
  id: z.string(),
  gardenId: z.string(),
  plantId: z.string().optional(),
  logDate: z.string(),
  pestOrDisease: z.string(),
  severity: z.enum(['low', 'medium', 'high']),
  treatment: z.string().optional(),
  resolved: z.boolean(),
  notes: z.string().optional(),
});

// Error schema for type-safe error handling
export const AuthErrorSchema = z.object({
  message: z.string(),
  status: z.number().optional(),
});

export type GardenPlanRow = z.infer<typeof GardenPlanRowSchema>;
export type FavouritePlantRow = z.infer<typeof FavouritePlantRowSchema>;
export type SeedItem = z.infer<typeof SeedItemSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type HarvestLog = z.infer<typeof HarvestLogSchema>;
export type PestLog = z.infer<typeof PestLogSchema>;
