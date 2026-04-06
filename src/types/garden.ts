export interface Plant {
  id: string;
  name: string;
  emoji: string;
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
  seedPackData?: Record<string, any>;
}

export type PlantStage = 'seed' | 'seedling';

export interface PlacedPlant {
  id: string;
  plantId: string;
  x: number;
  y: number;
  plantedAt: string; // ISO date string
  stage: PlantStage;
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

export interface PlacedStructure {
  id: string;
  structureId: string;
  x: number;
  y: number;
  widthCells: number;
  heightCells: number;
}

export interface PlotSettings {
  widthM: number;
  heightM: number;
  unit: 'meters' | 'feet';
  cellSizePx: number;
  cellSizeCm: number;
  southDirection: number; // degrees clockwise from top (0=north at top, 90=east at top, 180=south at top)
}

export interface GardenPlan {
  id: string;
  name: string;
  settings: PlotSettings;
  plants: PlacedPlant[];
  beds: GardenBed[];
}
