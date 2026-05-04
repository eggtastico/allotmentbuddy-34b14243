import { useCallback } from 'react';
import { PlacedPlant, PlacedStructure } from '@/types/garden';
import { GardenState, GardenActions } from './useGardenState';
import { getStructureById } from '@/data/structures';

export interface StructureManagementActions {
  placeStructure: (structureId: string, x: number, y: number) => void;
  removeStructure: (id: string) => void;
  resizeStructure: (id: string, widthCells: number, heightCells: number) => void;
  moveStructure: (id: string, x: number, y: number) => void;
}

export function useStructureManagement(
  gardenState: GardenState,
  gardenActions: GardenActions,
  pushUndo: (plants: PlacedPlant[], structures: PlacedStructure[]) => void,
): StructureManagementActions {
  const { placedPlants, placedStructures } = gardenState;
  const { setPlacedStructures } = gardenActions;

  const placeStructure = useCallback(
    (structureId: string, x: number, y: number) => {
      pushUndo(placedPlants, placedStructures);
      const structDef = getStructureById(structureId);
      const newStructure: PlacedStructure = {
        id: Math.random().toString(36).substr(2, 9),
        structureId,
        x: Math.round(x),
        y: Math.round(y),
        widthCells: structDef?.widthCells ?? 2,
        heightCells: structDef?.heightCells ?? 2,
      };
      setPlacedStructures([...placedStructures, newStructure]);
    },
    [placedPlants, placedStructures, setPlacedStructures, pushUndo],
  );

  const removeStructure = useCallback(
    (id: string) => {
      pushUndo(placedPlants, placedStructures);
      setPlacedStructures(placedStructures.filter((s) => s.id !== id));
    },
    [placedPlants, placedStructures, setPlacedStructures, pushUndo],
  );

  const resizeStructure = useCallback(
    (id: string, widthCells: number, heightCells: number) => {
      pushUndo(placedPlants, placedStructures);
      setPlacedStructures(
        placedStructures.map((s) =>
          s.id === id ? { ...s, widthCells, heightCells } : s,
        ),
      );
    },
    [placedPlants, placedStructures, setPlacedStructures, pushUndo],
  );

  const moveStructure = useCallback(
    (id: string, x: number, y: number) => {
      pushUndo(placedPlants, placedStructures);
      setPlacedStructures(
        placedStructures.map((s) =>
          s.id === id ? { ...s, x: Math.round(x), y: Math.round(y) } : s,
        ),
      );
    },
    [placedPlants, placedStructures, setPlacedStructures, pushUndo],
  );

  return {
    placeStructure,
    removeStructure,
    resizeStructure,
    moveStructure,
  };
}
