import { useCallback } from 'react';
import { PlacedPlant, PlacedStructure, PlotSettings, PlantStage } from '@/types/garden';
import { FavouritePlant } from '@/hooks/useFavouritePlants';
import { FrostDates } from '@/utils/frostDateCalculator';
import { getPlantById, plants as allPlantsList } from '@/data/plants';
import { toast } from 'sonner';

interface UsePlantHandlersParams {
  placedPlants: PlacedPlant[];
  placedStructures: PlacedStructure[];
  setPlacedPlants: React.Dispatch<React.SetStateAction<PlacedPlant[]>>;
  setPlacedStructures: React.Dispatch<React.SetStateAction<PlacedStructure[]>>;
  setSelectedPlant: React.Dispatch<React.SetStateAction<PlacedPlant | null>>;
  selectedPlant: PlacedPlant | null;
  settings: PlotSettings;
  frostDates: FrostDates | null;
  defaultStage: PlantStage;
  pushUndo: (plants: PlacedPlant[], structures: PlacedStructure[]) => void;
  handleUndo: () => void;
  getFavouritesWithQuantity: () => FavouritePlant[];
  setDragging: React.Dispatch<React.SetStateAction<string | null>>;
  setShowClearConfirm: React.Dispatch<React.SetStateAction<boolean>>;
}

export function usePlantHandlers({
  placedPlants,
  placedStructures,
  setPlacedPlants,
  setPlacedStructures,
  setSelectedPlant,
  selectedPlant,
  settings,
  frostDates,
  defaultStage,
  pushUndo,
  handleUndo,
  getFavouritesWithQuantity,
  setDragging,
  setShowClearConfirm,
}: UsePlantHandlersParams) {
  const handlePlacePlant = useCallback((plantId: string, x: number, y: number) => {
    // Check spacing: new plant must be far enough from same-type plants
    const plantData = getPlantById(plantId);
    const spacingCells = plantData ? Math.max(1, plantData.spacingCm / settings.cellSizeCm) : 1;
    const tooClose = placedPlants.some(p => {
      const dist = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
      if (dist < 0.5) return true; // overlapping
      if (p.plantId === plantId && dist < spacingCells) return true; // same plant too close
      return false;
    });
    if (tooClose) {
      setDragging(null);
      toast.error(`${plantData?.name || 'Plant'} needs ${plantData?.spacingCm || 20}cm spacing`);
      return;
    }

    // Frost warning: alert if placing a frost-sensitive plant within 4 weeks of last frost date
    if (plantData && frostDates && (plantData.frostHardiness === 'tender' || plantData.frostHardiness === 'half-hardy')) {
      const now = new Date();
      const lastFrost = frostDates.lastFrostDate;
      const daysToLastFrost = Math.ceil((lastFrost.getTime() - now.getTime()) / 86400000);
      if (daysToLastFrost > 0 && daysToLastFrost <= 28) {
        toast.warning(
          `Warning: Frost risk: ${plantData.name} is ${plantData.frostHardiness} -- last frost expected in ~${daysToLastFrost} days. Consider waiting or using protection.`,
          { duration: 6000 }
        );
      }
    }

    pushUndo(placedPlants, placedStructures);
    setPlacedPlants(prev => [...prev, {
      id: `${plantId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      plantId, x, y,
      plantedAt: new Date().toISOString(),
      stage: defaultStage,
    }]);
    setDragging(null);
    // Dep array preserved verbatim from Index; setDragging is a stable useState setter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placedPlants, placedStructures, defaultStage, pushUndo, settings.cellSizeCm, frostDates, setPlacedPlants]);

  const handleFillPlantArea = useCallback((plantId: string, originX: number, originY: number, w: number, h: number) => {
    pushUndo(placedPlants, placedStructures);
    const plantData = getPlantById(plantId);
    const spacingCells = plantData ? Math.max(1, Math.ceil(plantData.spacingCm / settings.cellSizeCm)) : 1;
    setPlacedPlants(prev => {
      const newPlants: PlacedPlant[] = [];
      const allPlants = [...prev];
      // Step by spacing interval instead of every cell
      for (let dy = 0; dy < h; dy += spacingCells) {
        for (let dx = 0; dx < w; dx += spacingCells) {
          const px = originX + dx;
          const py = originY + dy;
          // Check no existing plant is too close
          const blocked = allPlants.some(p => {
            const dist = Math.sqrt((p.x - px) ** 2 + (p.y - py) ** 2);
            return dist < spacingCells * 0.9;
          });
          if (blocked) continue;
          const np: PlacedPlant = {
            id: `${plantId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${dx}-${dy}`,
            plantId, x: px, y: py,
            plantedAt: new Date().toISOString(),
            stage: defaultStage,
          };
          newPlants.push(np);
          allPlants.push(np);
        }
      }
      return [...prev, ...newPlants];
    });
  }, [placedPlants, placedStructures, pushUndo, settings.cellSizeCm, defaultStage, setPlacedPlants]);

  const handleSmartAutoFill = useCallback((originX: number, originY: number, w: number, h: number, isContainer: boolean) => {
    pushUndo(placedPlants, placedStructures);
    const favs = getFavouritesWithQuantity();

    const slots: { plantId: string; maxQty: number; spacingCells: number }[] = [];

    const existingCounts: Record<string, number> = {};
    for (const p of placedPlants) {
      existingCounts[p.plantId] = (existingCounts[p.plantId] || 0) + 1;
    }

    for (const fav of favs) {
      const plant = getPlantById(fav.plantId);
      if (!plant) continue;
      if (isContainer && plant.spacingCm > 50) continue;
      const spacingCells = Math.max(1, Math.ceil(plant.spacingCm / settings.cellSizeCm));
      const existing = existingCounts[fav.plantId] || 0;
      const remaining = fav.quantity > 0 ? Math.max(0, fav.quantity - existing) : Infinity;
      if (remaining <= 0) continue;
      slots.push({ plantId: fav.plantId, maxQty: remaining === Infinity ? 9999 : remaining, spacingCells });
    }

    if (slots.length === 0) {
      const suggested = allPlantsList.filter(p => !isContainer || p.spacingCm <= 50).slice(0, 3);
      for (const p of suggested) {
        slots.push({ plantId: p.id, maxQty: 9999, spacingCells: Math.max(1, Math.ceil(p.spacingCm / settings.cellSizeCm)) });
      }
    }

    setPlacedPlants(prev => {
      const newPlants: PlacedPlant[] = [];
      const allPlants = [...prev];

      const positions: { x: number; y: number }[] = [];
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          positions.push({ x: originX + dx, y: originY + dy });
        }
      }

      for (const slot of slots) {
        let placed = 0;
        for (const pos of positions) {
          if (placed >= slot.maxQty) break;
          const tooClose = allPlants.some(p => {
            const dist = Math.sqrt((p.x - pos.x) ** 2 + (p.y - pos.y) ** 2);
            if (dist < 0.5) return true;
            if (p.plantId === slot.plantId && dist < slot.spacingCells * 0.9) return true;
            return false;
          });
          if (tooClose) continue;

          const np: PlacedPlant = {
            id: `${slot.plantId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${pos.x}-${pos.y}`,
            plantId: slot.plantId, x: pos.x, y: pos.y,
            plantedAt: new Date().toISOString(),
            stage: defaultStage,
          };
          newPlants.push(np);
          allPlants.push(np);
          placed++;
        }
      }

      return [...prev, ...newPlants];
    });
  }, [placedPlants, placedStructures, pushUndo, settings.cellSizeCm, defaultStage, getFavouritesWithQuantity, setPlacedPlants]);

  const handleRemovePlant = useCallback((id: string) => {
    const removed = placedPlants.find(p => p.id === id);
    pushUndo(placedPlants, placedStructures);
    setPlacedPlants(prev => prev.filter(p => p.id !== id));
    if (selectedPlant?.id === id) setSelectedPlant(null);

    if (removed) {
      const name = getPlantById(removed.plantId)?.name ?? 'Plant';
      toast(`${name} removed`, {
        action: {
          label: 'Undo',
          onClick: () => handleUndo(),
        },
        duration: 5000,
      });
    }
  }, [selectedPlant, pushUndo, placedPlants, placedStructures, handleUndo, setPlacedPlants, setSelectedPlant]);

  const handleUpdatePlacedPlant = useCallback((updated: PlacedPlant) => {
    setPlacedPlants(prev => prev.map(p => p.id === updated.id ? updated : p));
    setSelectedPlant(prev => prev?.id === updated.id ? updated : prev);
  }, [setPlacedPlants, setSelectedPlant]);

  const handleMovePlantStart = useCallback(() => {
    pushUndo(placedPlants, placedStructures);
  }, [placedPlants, placedStructures, pushUndo]);

  const handleMovePlant = useCallback((id: string, x: number, y: number) => {
    const plantToMove = placedPlants.find(p => p.id === id);
    if (!plantToMove) return;

    const positionUnchanged = plantToMove.x === x && plantToMove.y === y;
    const occupied = placedPlants.some(p => p.id !== id && p.x === x && p.y === y);
    if (positionUnchanged || occupied) return;

    setPlacedPlants(prev => prev.map(p => p.id === id ? { ...p, x, y } : p));
    setSelectedPlant(prev => prev?.id === id ? { ...prev, x, y } : prev);
  }, [placedPlants, setPlacedPlants, setSelectedPlant]);

  const confirmClear = useCallback(() => {
    pushUndo(placedPlants, placedStructures);
    setPlacedPlants([]);
    setPlacedStructures([]);
    setSelectedPlant(null);
    setShowClearConfirm(false);
  }, [placedPlants, placedStructures, pushUndo, setShowClearConfirm, setPlacedPlants, setPlacedStructures, setSelectedPlant]);

  return {
    handlePlacePlant,
    handleFillPlantArea,
    handleSmartAutoFill,
    handleRemovePlant,
    handleUpdatePlacedPlant,
    handleMovePlantStart,
    handleMovePlant,
    confirmClear,
  };
}
