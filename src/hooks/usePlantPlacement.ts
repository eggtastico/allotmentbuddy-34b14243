import { useCallback, useState } from 'react';
import { PlacedPlant, PlacedStructure, PlantStage } from '@/types/garden';
import { getPlantById, plants as allPlantsList } from '@/data/plants';
import { toast } from 'sonner';
import { GardenState, GardenActions } from './useGardenState';

export interface PlantPlacementState {
  pendingPlantId: string | null;
  pendingIsStructure: boolean;
  dragging: string | null;
}

export interface PlantPlacementActions {
  selectForPlacement: (plantId: string, isStructure?: boolean) => void;
  cancelPending: () => void;
  placePlant: (plantId: string, x: number, y: number) => void;
  fillPlantArea: (
    plantId: string,
    originX: number,
    originY: number,
    w: number,
    h: number,
  ) => void;
  smartAutoFill: (
    originX: number,
    originY: number,
    w: number,
    h: number,
    isContainer: boolean,
  ) => void;
  removePlant: (id: string) => void;
  moveStart: () => void;
  movePlant: (id: string, x: number, y: number) => void;
  setDragging: (id: string | null) => void;
}

export interface UsePlantPlacementOptions {
  getFavourites?: () => Array<{ plantId: string; quantity: number }>;
  onMobileSidebarOpen?: (open: boolean) => void;
}

export function usePlantPlacement(
  gardenState: GardenState,
  gardenActions: GardenActions,
  pushUndo: (plants: PlacedPlant[], structures: PlacedStructure[]) => void,
  options: UsePlantPlacementOptions = {},
): [PlantPlacementState, PlantPlacementActions] {
  const [pendingPlantId, setPendingPlantId] = useState<string | null>(null);
  const [pendingIsStructure, setPendingIsStructure] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);

  const { placedPlants, placedStructures, settings, defaultStage, selectedPlant } = gardenState;
  const { setPlacedPlants, setSelectedPlant } = gardenActions;
  const { getFavourites, onMobileSidebarOpen } = options;

  const selectForPlacement = useCallback(
    (plantId: string, isStructure = false) => {
      setPendingPlantId((prev) => (prev === plantId ? null : plantId));
      setPendingIsStructure(isStructure);
      if (onMobileSidebarOpen) {
        onMobileSidebarOpen(false);
      }
    },
    [onMobileSidebarOpen],
  );

  const cancelPending = useCallback(() => {
    setPendingPlantId(null);
    setPendingIsStructure(false);
  }, []);

  const placePlant = useCallback(
    (plantId: string, x: number, y: number) => {
      const plantData = getPlantById(plantId);
      const spacingCells = plantData
        ? Math.max(1, plantData.spacingCm / settings.cellSizeCm)
        : 1;

      const tooClose = placedPlants.some((p) => {
        const dist = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
        if (dist < 0.5) return true;
        if (p.plantId === plantId && dist < spacingCells) return true;
        return false;
      });

      if (tooClose) {
        setDragging(null);
        toast.error(
          `${plantData?.name || 'Plant'} needs ${plantData?.spacingCm || 20}cm spacing`,
        );
        return;
      }

      pushUndo(placedPlants, placedStructures);
      setPlacedPlants([
        ...placedPlants,
        {
          id: `${plantId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          plantId,
          x,
          y,
          plantedAt: new Date().toISOString(),
          stage: defaultStage,
        },
      ]);
      setDragging(null);
    },
    [placedPlants, placedStructures, defaultStage, pushUndo, settings.cellSizeCm, setPlacedPlants],
  );

  const fillPlantArea = useCallback(
    (plantId: string, originX: number, originY: number, w: number, h: number) => {
      pushUndo(placedPlants, placedStructures);
      const plantData = getPlantById(plantId);
      const spacingCells = plantData
        ? Math.max(1, Math.ceil(plantData.spacingCm / settings.cellSizeCm))
        : 1;

      setPlacedPlants((prev) => {
        // Collect all valid positions in the area
        const validPositions: Array<{ x: number; y: number }> = [];

        for (let dy = 0; dy < h; dy += spacingCells) {
          for (let dx = 0; dx < w; dx += spacingCells) {
            const px = originX + dx;
            const py = originY + dy;
            const blocked = prev.some((p) => {
              const dist = Math.sqrt((p.x - px) ** 2 + (p.y - py) ** 2);
              return dist < spacingCells * 0.9;
            });
            if (!blocked) validPositions.push({ x: px, y: py });
          }
        }

        if (validPositions.length === 0) return prev;

        // Place ONE representative plant at the top-left origin of the area,
        // spanning the full area (areaW × areaH) with quantity = plant count.
        const np: PlacedPlant = {
          id: `${plantId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          plantId,
          x: originX,
          y: originY,
          plantedAt: new Date().toISOString(),
          stage: defaultStage,
          quantity: validPositions.length,
          areaW: w,
          areaH: h,
        };

        return [...prev, np];
      });
    },
    [placedPlants, placedStructures, pushUndo, settings.cellSizeCm, defaultStage, setPlacedPlants],
  );

  const smartAutoFill = useCallback(
    (originX: number, originY: number, w: number, h: number, isContainer: boolean) => {
      pushUndo(placedPlants, placedStructures);
      const favs = getFavourites?.() || [];

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
        const remaining =
          fav.quantity > 0 ? Math.max(0, fav.quantity - existing) : Infinity;

        if (remaining <= 0) continue;

        slots.push({
          plantId: fav.plantId,
          maxQty: remaining === Infinity ? 9999 : remaining,
          spacingCells,
        });
      }

      if (slots.length === 0) {
        const suggested = allPlantsList
          .filter((p) => !isContainer || p.spacingCm <= 50)
          .slice(0, 3);

        for (const p of suggested) {
          slots.push({
            plantId: p.id,
            maxQty: 9999,
            spacingCells: Math.max(1, Math.ceil(p.spacingCm / settings.cellSizeCm)),
          });
        }
      }

      setPlacedPlants((prev) => {
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

            const tooClose = allPlants.some((p) => {
              const dist = Math.sqrt((p.x - pos.x) ** 2 + (p.y - pos.y) ** 2);
              if (dist < 0.5) return true;
              if (p.plantId === slot.plantId && dist < slot.spacingCells * 0.9)
                return true;
              return false;
            });

            if (tooClose) continue;

            const np: PlacedPlant = {
              id: `${slot.plantId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${pos.x}-${pos.y}`,
              plantId: slot.plantId,
              x: pos.x,
              y: pos.y,
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
    },
    [placedPlants, placedStructures, pushUndo, settings.cellSizeCm, defaultStage, getFavourites, setPlacedPlants],
  );

  const removePlant = useCallback(
    (id: string) => {
      pushUndo(placedPlants, placedStructures);
      setPlacedPlants((prev) => prev.filter((p) => p.id !== id));
      if (selectedPlant?.id === id) setSelectedPlant(null);
    },
    [selectedPlant, pushUndo, placedPlants, placedStructures, setPlacedPlants, setSelectedPlant],
  );

  const moveStart = useCallback(() => {
    pushUndo(placedPlants, placedStructures);
  }, [placedPlants, placedStructures, pushUndo]);

  const movePlant = useCallback(
    (id: string, x: number, y: number) => {
      const plantToMove = placedPlants.find((p) => p.id === id);
      if (!plantToMove) return;

      const positionUnchanged = plantToMove.x === x && plantToMove.y === y;
      const occupied = placedPlants.some(
        (p) => p.id !== id && p.x === x && p.y === y,
      );

      if (positionUnchanged || occupied) return;

      setPlacedPlants((prev) =>
        prev.map((p) => (p.id === id ? { ...p, x, y } : p)),
      );
      setSelectedPlant((prev) => (prev?.id === id ? { ...prev, x, y } : prev));
    },
    [placedPlants, setPlacedPlants, setSelectedPlant],
  );

  const state: PlantPlacementState = {
    pendingPlantId,
    pendingIsStructure,
    dragging,
  };

  const actions: PlantPlacementActions = {
    selectForPlacement,
    cancelPending,
    placePlant,
    fillPlantArea,
    smartAutoFill,
    removePlant,
    moveStart,
    movePlant,
    setDragging,
  };

  return [state, actions];
}
