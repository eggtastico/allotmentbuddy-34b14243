export interface Plant {
  id: string;
  name: string;
  emoji: string;
  category: 'vegetable' | 'fruit' | 'herb' | 'flower';
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
}

export interface PlacedPlant {
  id: string;
  plantId: string;
  x: number;
  y: number;
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
}

export interface GardenPlan {
  id: string;
  name: string;
  settings: PlotSettings;
  plants: PlacedPlant[];
  beds: GardenBed[];
}
