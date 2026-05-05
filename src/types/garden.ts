export interface Plant {
  id: string;
  name: string;
  emoji: string;
  /** Optional path (relative to BASE_URL) to a custom sprite image used instead of the emoji. */
  sprite?: string;
  category: 'vegetable' | 'fruit' | 'herb' | 'flower';
  variety?: string;
  spacingCm: number;
  companions: string[];
  enemies: string[];
  rotationGroup: 'legumes' | 'brassicas' | 'roots' | 'alliums' | 'solanaceae' | 'cucurbits' | 'leafy' | 'other';
  sowIndoors?: string;
  sowOutdoors?: string;
  harvest?: string;
  daysToHarvest?: number;
  yieldPerPlant?: string;
  notes?: string;
  sunPreference?: 'full-sun' | 'partial-shade' | 'full-shade' | 'any';
  family?: string;
  frostHardiness?: 'hardy' | 'half-hardy' | 'tender';
  difficulty?: 'easy' | 'moderate' | 'challenging';
  sowingSeason?: string[];
  tips?: string;
  seedPackData?: Record<string, unknown>;
}

export type PlantStage = 'seed' | 'seedling' | 'established';

export interface PlantPhoto {
  id: string;
  dataUrl: string; // Base64 encoded image
  timestamp: number;
  width?: number;
  height?: number;
}

export interface PlacedPlant {
  id: string;
  plantId: string;
  x: number;
  y: number;
  plantedAt: string; // ISO date string
  stage: PlantStage;
  quantity?: number; // number of plants in this planting (defaults to 1 if absent)
  areaW?: number; // width in grid cells when filling an area (defaults to 1)
  areaH?: number; // height in grid cells when filling an area (defaults to 1)
  photos?: PlantPhoto[];
}

export interface GardenBed {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'bed' | 'path' | 'structure';
  label?: string;
}

export interface RotationYearEntry {
  year: number;
  group: string; // one of the rotationGroup values
}

export interface PlacedStructure {
  id: string;
  structureId: string;
  x: number;
  y: number;
  widthCells: number;
  heightCells: number;
  name?: string; // Custom bed name
  rotationHistory?: RotationYearEntry[]; // Historical rotation data per year
}

export interface PlotSettings {
  widthM: number;
  heightM: number;
  unit: 'meters' | 'feet';
  cellSizePx: number;
  cellSizeCm: number;
  southDirection: number; // degrees clockwise from top (0=north at top, 90=east at top, 180=south at top)
  snapToGrid?: boolean; // if true, plants snap to grid cells; if false, free placement
}

export interface Location {
  lat: number;
  lng: number;
  accuracy?: number;
  address?: string;
  timestamp?: number;
}

export interface GardenPlan {
  id: string;
  name: string;
  settings: PlotSettings;
  plants: PlacedPlant[];
  beds: PlacedStructure[];
  location?: Location;
  updated_at?: string; // ISO timestamp for conflict resolution
}

export interface HarvestLog {
  id: string;
  gardenId: string;
  plantId: string;          // plant type id (from plants DB)
  placedPlantId: string;    // specific placed instance id
  harvestDate: string;      // ISO date string
  quantityHarvested?: number;
  weightGrams?: number;
  qualityRating?: 1 | 2 | 3 | 4 | 5;
  notes?: string;
}

export type PestSeverity = 'low' | 'medium' | 'high';

export interface PestLog {
  id: string;
  gardenId: string;
  plantId?: string;         // optional – log may cover whole garden
  logDate: string;          // ISO date string
  pestOrDisease: string;
  severity: PestSeverity;
  treatment?: string;
  resolved: boolean;
  notes?: string;
}
