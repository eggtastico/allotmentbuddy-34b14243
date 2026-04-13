import { z } from 'zod';

export const ShoppingItemSchema = z.object({
  plantId: z.string(),
  plantName: z.string(),
  variety: z.string().optional(),
  quantity: z.number().min(0),
  unit: z.enum(['seeds', 'seedlings', 'plants', 'bulbs', 'tubers']),
  sowingMethod: z.enum(['indoors', 'outdoors', 'both']),
  estimatedCost: z.number().optional(),
  notes: z.string().default(''),
  checked: z.boolean().default(false),
});

export type ShoppingItem = z.infer<typeof ShoppingItemSchema>;
