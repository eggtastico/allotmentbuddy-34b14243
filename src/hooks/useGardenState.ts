import { useState, useCallback } from 'react';
import { PlacedPlant, PlotSettings, PlacedStructure, PlantStage } from '@/types/garden';
import { GardenPlanRow, type LocationData } from '@/lib/schemas';
import { getStructureById } from '@/data/structures';

// Re-export LocationData so existing imports from this module still work
export type { LocationData } from '@/lib/schemas';

export interface GardenState {
  settings: PlotSettings;
  placedPlants: PlacedPlant[];
  selectedPlant: PlacedPlant | null;
  placedStructures: PlacedStructure[];
  currentPlanId: string | null;
  planName: string;
  location: LocationData | null;
  defaultStage: PlantStage;
}

export interface GardenActions {
  setSettings: (s: PlotSettings) => void;
  setPlacedPlants: (p: PlacedPlant[]) => void;
  setSelectedPlant: (p: PlacedPlant | null) => void;
  setPlacedStructures: (s: PlacedStructure[]) => void;
  setCurrentPlanId: (id: string | null) => void;
  setPlanName: (name: string) => void;
  setLocation: (loc: LocationData | null) => void;
  setDefaultStage: (stage: PlantStage) => void;
  loadPlan: (plan: GardenPlanRow) => void;
  clearAll: () => void;
}

export function useGardenState(): [GardenState, GardenActions] {
  const [settings, setSettings] = useState<PlotSettings>({
    widthM: 6,
    heightM: 4,
    unit: 'meters',
    cellSizePx: 32,
    cellSizeCm: 20,
    southDirection: 180,
    snapToGrid: true,
  });

  const [placedPlants, setPlacedPlants] = useState<PlacedPlant[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<PlacedPlant | null>(null);
  const [placedStructures, setPlacedStructures] = useState<PlacedStructure[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [planName, setPlanName] = useState('My Garden');
  const [location, setLocation] = useState<LocationData | null>(null);
  const [defaultStage, setDefaultStage] = useState<PlantStage>('seed');

  const loadPlan = useCallback((plan: GardenPlanRow) => {
    // plan.plot_settings is already validated by Zod in GardenPlanRowSchema
    setSettings(plan.plot_settings);
    setCurrentPlanId(plan.id);
    setPlanName(plan.name);
    setLocation(plan.location ?? null);

    setPlacedPlants(plan.plants as PlacedPlant[]);

    // beds are already migrated by RawStructureSchema (handles legacy field names)
    const migratedStructures = plan.beds.map(s => {
      if (s.widthCells === undefined || s.heightCells === undefined) {
        const structDef = getStructureById(s.structureId);
        return {
          ...s,
          widthCells: s.widthCells ?? structDef?.widthCells ?? 2,
          heightCells: s.heightCells ?? structDef?.heightCells ?? 2,
        };
      }
      return s;
    });
    setPlacedStructures(migratedStructures);

    setSelectedPlant(null);
    setDefaultStage('seed');
  }, []);

  const clearAll = useCallback(() => {
    setPlacedPlants([]);
    setPlacedStructures([]);
    setSelectedPlant(null);
    setCurrentPlanId(null);
    setPlanName('My Garden');
    setLocation(null);
    setDefaultStage('seed');
  }, []);

  const state: GardenState = {
    settings,
    placedPlants,
    selectedPlant,
    placedStructures,
    currentPlanId,
    planName,
    location,
    defaultStage,
  };

  const actions: GardenActions = {
    setSettings,
    setPlacedPlants,
    setSelectedPlant,
    setPlacedStructures,
    setCurrentPlanId,
    setPlanName,
    setLocation,
    setDefaultStage,
    loadPlan,
    clearAll,
  };

  return [state, actions];
}
