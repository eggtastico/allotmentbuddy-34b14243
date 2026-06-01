import { useCallback } from 'react';
import { PlacedPlant, PlacedStructure, PlantStage } from '@/types/garden';
import { getStructureById } from '@/data/structures';
import { toast } from 'sonner';

interface UseStructureHandlersParams {
  placedPlants: PlacedPlant[];
  placedStructures: PlacedStructure[];
  setPlacedStructures: React.Dispatch<React.SetStateAction<PlacedStructure[]>>;
  setPlacedPlants: React.Dispatch<React.SetStateAction<PlacedPlant[]>>;
  setSelectedBed: React.Dispatch<React.SetStateAction<PlacedStructure | null>>;
  pushUndo: (plants: PlacedPlant[], structures: PlacedStructure[]) => void;
  setDragging: React.Dispatch<React.SetStateAction<string | null>>;
  defaultStage: PlantStage;
  pendingStructureSizeRef: React.MutableRefObject<{ w: number; h: number } | null>;
  setPendingStructureSize: React.Dispatch<React.SetStateAction<{ w: number; h: number } | null>>;
}

export function useStructureHandlers({
  placedPlants,
  placedStructures,
  setPlacedStructures,
  setPlacedPlants,
  setSelectedBed,
  pushUndo,
  setDragging,
  defaultStage,
  pendingStructureSizeRef,
  setPendingStructureSize,
}: UseStructureHandlersParams) {
  const handlePlaceStructure = useCallback((structureId: string, x: number, y: number) => {
    const structData = getStructureById(structureId);
    if (!structData) return;
    const size = pendingStructureSizeRef.current;
    pushUndo(placedPlants, placedStructures);
    setPlacedStructures(prev => [...prev, {
      id: `${structureId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      structureId,
      x, y,
      widthCells: size?.w ?? structData.widthCells,
      heightCells: size?.h ?? structData.heightCells,
    }]);
    pendingStructureSizeRef.current = null;
    setPendingStructureSize(null);
    setDragging(null);
    // Dep array preserved verbatim from Index; ref + stable useState setters intentionally omitted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placedPlants, placedStructures, pushUndo, setPlacedStructures]);

  const handleRemoveStructure = useCallback((id: string) => {
    pushUndo(placedPlants, placedStructures);
    setPlacedStructures(prev => prev.filter(s => s.id !== id));
  }, [placedPlants, placedStructures, pushUndo, setPlacedStructures]);

  const handleResizeStructure = useCallback((id: string, widthCells: number, heightCells: number) => {
    setPlacedStructures(prev => prev.map(s => s.id === id ? { ...s, widthCells, heightCells } : s));
  }, [setPlacedStructures]);

  const handleMoveStructureStart = useCallback(() => {
    pushUndo(placedPlants, placedStructures);
  }, [placedPlants, placedStructures, pushUndo]);

  const handleMoveStructure = useCallback((id: string, x: number, y: number) => {
    setPlacedStructures(prev => {
      const bed = prev.find(s => s.id === id);
      if (bed) {
        const dx = x - bed.x;
        const dy = y - bed.y;
        if (dx !== 0 || dy !== 0) {
          setPlacedPlants(pp => pp.map(p => {
            const inBed = p.x >= bed.x && p.x < bed.x + bed.widthCells &&
                          p.y >= bed.y && p.y < bed.y + bed.heightCells;
            return inBed ? { ...p, x: p.x + dx, y: p.y + dy } : p;
          }));
        }
      }
      return prev.map(s => s.id === id ? { ...s, x, y } : s);
    });
  }, [setPlacedStructures, setPlacedPlants]);

  const handleUpdateStructure = useCallback((updated: PlacedStructure) => {
    setPlacedStructures(prev => prev.map(s => s.id === updated.id ? updated : s));
    setSelectedBed(prev => prev?.id === updated.id ? updated : prev);
  }, [setPlacedStructures, setSelectedBed]);

  const handleDuplicateBed = useCallback((bedId: string) => {
    const bed = placedStructures.find(s => s.id === bedId);
    if (!bed) return;
    pushUndo(placedPlants, placedStructures);
    const newBed: PlacedStructure = {
      ...bed,
      id: `${bed.structureId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      x: Math.min(bed.x + 1, 50),
      y: Math.min(bed.y + 1, 50),
      name: bed.name ? `${bed.name} copy` : undefined,
    };
    setPlacedStructures(prev => [...prev, newBed]);
    toast.success('Bed duplicated');
  }, [placedPlants, placedStructures, pushUndo, setPlacedStructures]);

  // Add a plant to a specific cell in a bed (col/row are relative to bed origin)
  const handleAddPlantToBed = useCallback((bed: PlacedStructure, plantId: string, col: number, row: number) => {
    const x = bed.x + col;
    const y = bed.y + row;
    const alreadyOccupied = placedPlants.some(p => p.x === x && p.y === y);
    if (alreadyOccupied) return;
    pushUndo(placedPlants, placedStructures);
    setPlacedPlants(prev => [...prev, {
      id: `${plantId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      plantId,
      x, y,
      plantedAt: new Date().toISOString(),
      stage: defaultStage,
    }]);
  }, [placedPlants, placedStructures, defaultStage, pushUndo, setPlacedPlants]);

  return {
    handlePlaceStructure,
    handleRemoveStructure,
    handleResizeStructure,
    handleMoveStructureStart,
    handleMoveStructure,
    handleUpdateStructure,
    handleDuplicateBed,
    handleAddPlantToBed,
  };
}
