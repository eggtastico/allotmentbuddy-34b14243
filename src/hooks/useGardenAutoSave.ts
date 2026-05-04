import { useRef, useEffect } from 'react';
import { PlacedPlant, PlacedStructure, PlotSettings, GardenPlan } from '@/types/garden';
import { useAuth } from '@/hooks/use-auth';
import { useGardenPlans } from '@/hooks/useGardenPlans';
import { saveLocalGarden, queueSyncItem, markAsSynced, updateSyncStatus } from '@/lib/db';
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
      const now = new Date().toISOString();
      const gardenPlan: GardenPlan = {
        id: currentPlanId || generateId(),
        name: planName,
        settings,
        plants: placedPlants,
        beds: placedStructures,
        updated_at: now,
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
      const now = new Date().toISOString();
      const gardenPlan: GardenPlan = {
        id: currentPlanId ?? generateId(),
        name: planName,
        settings,
        plants: placedPlants,
        beds: placedStructures,
        updated_at: now,
      };

      // Queue the sync item, then attempt a direct Supabase save
      queueSyncItem({
        action: currentPlanId ? 'update' : 'create',
        entityType: 'garden',
        entityId: gardenPlan.id,
        data: gardenPlan,
      })
        .then((queueId) => {
          return save({
            id: currentPlanId ?? undefined,
            name: planName,
            settings,
            plants: placedPlants,
            beds: placedStructures
          }).then((result: { id: string; updated_at?: string }) => ({ result, queueId }));
        })
        .then(({ result, queueId }) => {
          // Direct save succeeded — remove the queue item so it isn't double-synced
          markAsSynced(queueId).catch(console.error);
          if (!currentPlanId && result?.id) onPlanIdChange(result.id);
          // Sync local updated_at with the server timestamp
          if (result?.updated_at) {
            saveLocalGarden({
              ...gardenPlan,
              id: result.id || gardenPlan.id,
              updated_at: result.updated_at,
            }).catch(console.error);
          }
        })
        .catch((err) => {
          // Direct save failed — item stays queued for retry. Surface the error in the UI.
          const msg = err instanceof Error ? err.message : 'Cloud save failed';
          updateSyncStatus({ lastError: msg }).catch(console.error);
        });
    }, 3000);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      if (localSaveTimer.current) clearTimeout(localSaveTimer.current);
    };
  }, [placedPlants, placedStructures, settings, user, currentPlanId, planName, save, onPlanIdChange]);
}
