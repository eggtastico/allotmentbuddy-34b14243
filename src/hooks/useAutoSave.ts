import { useState, useEffect, useRef } from 'react';
import { PlacedPlant, PlacedStructure, PlotSettings } from '@/types/garden';
import { useGardenPlans } from '@/hooks/useGardenPlans';
import { useGardenAutoSave } from '@/hooks/useGardenAutoSave';

export interface UseAutoSaveOptions {
  placedPlants: PlacedPlant[];
  placedStructures: PlacedStructure[];
  settings: PlotSettings;
  currentPlanId: string | null;
  planName: string;
  setCurrentPlanId: (id: string) => void;
}

export interface UseAutoSaveReturn {
  /** Whether a cloud save is currently in flight. */
  isSaving: boolean;
  /** Flash flag: true for ~2 s after a save completes. */
  showSaved: boolean;
  /** Available remote plans (from useGardenPlans). */
  plans: ReturnType<typeof useGardenPlans>['plans'];
  /** The underlying save function from useGardenPlans. */
  save: ReturnType<typeof useGardenPlans>['save'];
}

/**
 * Combines useGardenPlans + useGardenAutoSave + the "Saved" flash indicator
 * into one self-contained hook.
 */
export function useAutoSave(options: UseAutoSaveOptions): UseAutoSaveReturn {
  const { placedPlants, placedStructures, settings, currentPlanId, planName, setCurrentPlanId } = options;

  const { plans, save, isSaving } = useGardenPlans();

  // Auto-save with debounce (3s after last change)
  useGardenAutoSave(placedPlants, placedStructures, settings, currentPlanId, planName, setCurrentPlanId);

  // Auto-save flash indicator
  const [showSaved, setShowSaved] = useState(false);
  const wasSavingRef = useRef(false);

  useEffect(() => {
    if (wasSavingRef.current && !isSaving) {
      setShowSaved(true);
      const t = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(t);
    }
    wasSavingRef.current = isSaving;
  }, [isSaving]);

  return {
    isSaving,
    showSaved,
    plans,
    save,
  };
}
