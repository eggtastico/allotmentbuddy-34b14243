import { useState, useCallback } from 'react';
import { PlacedPlant, PlacedStructure } from '@/types/garden';

export interface GardenSnapshot {
  plants: PlacedPlant[];
  structures: PlacedStructure[];
}

export interface UndoRedoState {
  undoStack: GardenSnapshot[];
  redoStack: GardenSnapshot[];
  canUndo: boolean;
  canRedo: boolean;
  pushUndo: (plants: PlacedPlant[], structures: PlacedStructure[]) => void;
  handleUndo: (currentPlants: PlacedPlant[], currentStructures: PlacedStructure[]) => GardenSnapshot | null;
  handleRedo: (currentPlants: PlacedPlant[], currentStructures: PlacedStructure[]) => GardenSnapshot | null;
}

interface UndoRedoOptions {
  maxHistory?: number;
  onUndoStateChange?: (snapshot: GardenSnapshot) => void;
  onRedoStateChange?: (snapshot: GardenSnapshot) => void;
}

export function useUndoRedo(options: UndoRedoOptions = {}): UndoRedoState {
  const { maxHistory = 50, onUndoStateChange, onRedoStateChange } = options;

  const [undoStack, setUndoStack] = useState<GardenSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<GardenSnapshot[]>([]);

  const pushUndo = useCallback(
    (plants: PlacedPlant[], structures: PlacedStructure[]) => {
      setUndoStack((prev) => [...prev.slice(-(maxHistory - 1)), { plants, structures }]);
      setRedoStack([]);
    },
    [maxHistory],
  );

  const handleUndo = useCallback((currentPlants: PlacedPlant[], currentStructures: PlacedStructure[]): GardenSnapshot | null => {
    let result: GardenSnapshot | null = null;
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const undoneState = prev[prev.length - 1];
      result = undoneState;
      setRedoStack((r) => [...r, { plants: currentPlants, structures: currentStructures }]);
      onUndoStateChange?.(undoneState);
      return prev.slice(0, -1);
    });
    return result;
  }, [onUndoStateChange]);

  const handleRedo = useCallback((currentPlants: PlacedPlant[], currentStructures: PlacedStructure[]): GardenSnapshot | null => {
    let result: GardenSnapshot | null = null;
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const redoneState = prev[prev.length - 1];
      result = redoneState;
      setUndoStack((u) => [...u, { plants: currentPlants, structures: currentStructures }]);
      onRedoStateChange?.(redoneState);
      return prev.slice(0, -1);
    });
    return result;
  }, [onRedoStateChange]);

  return {
    undoStack,
    redoStack,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    pushUndo,
    handleUndo,
    handleRedo,
  };
}
