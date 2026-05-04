import { z } from 'zod';
import { PlacedPlant, PlacedStructure, PlotSettings } from '@/types/garden';
import {
  PlotSettingsSchema,
  PlacedPlantSchema,
  PlacedStructureSchema,
} from '@/lib/schemas';

/** Current export format version */
const EXPORT_VERSION = 1;

/** Schema for validating imported garden JSON files */
const GardenExportSchema = z.object({
  version: z.number().int().positive(),
  exportedAt: z.string(),
  name: z.string(),
  settings: PlotSettingsSchema,
  plants: z.array(PlacedPlantSchema).catch([]),
  structures: z.array(PlacedStructureSchema).catch([]),
});

export type GardenExportData = z.infer<typeof GardenExportSchema>;

/**
 * Build the export payload from current garden state.
 */
function buildExportData(
  name: string,
  settings: PlotSettings,
  plants: PlacedPlant[],
  structures: PlacedStructure[],
): GardenExportData {
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    name,
    settings,
    plants,
    structures,
  };
}

/**
 * Trigger a JSON file download in the browser.
 */
export function exportGardenJSON(
  name: string,
  settings: PlotSettings,
  plants: PlacedPlant[],
  structures: PlacedStructure[],
): void {
  const data = buildExportData(name, settings, plants, structures);
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const safeName = name
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeName || 'garden'}.garden.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Parse and validate an imported garden JSON string.
 * Returns the validated data on success, or an error message string on failure.
 */
export function parseGardenJSON(
  jsonString: string,
): GardenExportData | string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return 'The selected file is not valid JSON.';
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return 'The file does not contain a valid garden plan.';
  }

  const result = GardenExportSchema.safeParse(parsed);
  if (!result.success) {
    return 'The file is not a valid garden plan. It may be corrupted or in an unsupported format.';
  }

  return result.data;
}
