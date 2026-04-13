import { useRef, useEffect } from 'react';
import { PlacedPlant, PlacedStructure, PlotSettings, GardenPlan } from '@/types/garden';
import { useAuth } from '@/hooks/useAuth';
import { useGardenPlans } from '@/hooks/useGardenPlans';
import { saveLocalGarden, queueSyncItem } from '@/lib/db';
import { generateId } from '@/lib/uuid';

/**
 * Auto-save hook: Debounces saves to both local IndexedDB and Supabase
 * - Saves to IndexedDB immediately for offline support
 * - Saves to Supabase after 3 seconds of inactivity
 */
export function useGardenAutoSave(
  placedPlants: PlacedPlant[],
  placedStructures: PlacedStructure[],
  settings: PlotSettings,
  currentPlanId: string | null,
  planName: string,
  onPlanIdChange: (id: string) => void
) {
  const { user } = useAuth();
  const { save } = useGardenPlans();
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const localSaveTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!user || (placedPlants.length === 0 && placedStructures.length === 0)) return;

    // Save to IndexedDB immediately (debounced)
    if (localSaveTimer.current) clearTimeout(localSaveTimer.current);

    localSaveTimer.current = setTimeout(() => {
      const gardenPlan: GardenPlan = {
        id: currentPlanId || generateId(),
        name: planName,
        settings,
        plants: placedPlants,
        beds: placedStructures,
      };

      saveLocalGarden(gardenPlan)
        .then(() => {
          if (!currentPlanId) {
            onPlanIdChange(gardenPlan.id);
          }
        })
        .catch(console.error);
    }, 500); // Faster local save

    // Queue for Supabase sync
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    autoSaveTimer.current = setTimeout(() => {
      const gardenPlan: GardenPlan = {
        id: currentPlanId ?? generateId(),
        name: planName,
        settings,
        plants: placedPlants,
        beds: placedStructures,
      };

      // Queue the sync
      queueSyncItem({
        action: currentPlanId ? 'update' : 'create',
        entityType: 'garden',
        entityId: gardenPlan.id,
        data: gardenPlan,
      })
        .then(() => {
          // Try to save to Supabase
          return save({
            id: currentPlanId ?? undefined,
            name: planName,
            settings,
            plants: placedPlants,
            beds: placedStructures
          });
        })
        .then((result: { id: string }) => {
          if (!currentPlanId && result?.id) onPlanIdChange(result.id);
        })
        .catch(() => {
          // Save is queued, will retry when online
        });
    }, 3000);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      if (localSaveTimer.current) clearTimeout(localSaveTimer.current);
    };
  }, [placedPlants, placedStructures, settings, user, currentPlanId, planName, save, onPlanIdChange]);
}
