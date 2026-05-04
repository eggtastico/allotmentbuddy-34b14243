import { useCallback, useState } from 'react';
import { getLocalGarden, saveLocalGarden } from '@/lib/db';
import { GardenPlanRow } from '@/lib/schemas';
import { GardenPlan } from '@/types/garden';

export type ConflictChoice = 'local' | 'remote' | null;

export interface ConflictInfo {
  planId: string;
  planName: string;
  localUpdatedAt: string;
  remoteUpdatedAt: string;
  remotePlan: GardenPlanRow;
  localPlan: GardenPlan;
}

/**
 * Hook for resolving conflicts between local (IndexedDB) and remote (Supabase)
 * garden plan versions. Uses a "last-write-wins with notification" strategy:
 *
 * - If remote is newer than local, prompt the user to choose which version to keep
 * - If local is newer (or no local copy exists), proceed normally
 * - If timestamps match, proceed normally (no conflict)
 */
export function useConflictResolution() {
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);

  /**
   * Check whether a remote plan conflicts with the local version.
   * Returns the plan to load (remote by default), or null if a conflict
   * dialog needs to be shown first.
   */
  const checkForConflict = useCallback(
    async (remotePlan: GardenPlanRow): Promise<GardenPlanRow | null> => {
      try {
        const localPlan = await getLocalGarden(remotePlan.id);

        // No local copy -- no conflict, use remote
        if (!localPlan) {
          return remotePlan;
        }

        const localUpdatedAt = localPlan.updated_at;
        const remoteUpdatedAt = remotePlan.updated_at;

        // If the local plan has no timestamp, it predates this feature.
        // Treat remote as authoritative.
        if (!localUpdatedAt) {
          return remotePlan;
        }

        // If remote has no timestamp (shouldn't happen with Supabase defaults, but
        // be defensive), treat local as authoritative -- just load remote.
        if (!remoteUpdatedAt) {
          return remotePlan;
        }

        const localTime = new Date(localUpdatedAt).getTime();
        const remoteTime = new Date(remoteUpdatedAt).getTime();

        // If timestamps are within 5 seconds of each other, treat as the same
        // save (avoids false positives from slight clock drift between the local
        // timestamp and the server-side default).
        const DRIFT_TOLERANCE_MS = 5000;
        if (Math.abs(localTime - remoteTime) <= DRIFT_TOLERANCE_MS) {
          return remotePlan;
        }

        // Remote is newer -- no conflict, remote wins silently
        if (remoteTime > localTime) {
          return remotePlan;
        }

        // Local is newer than remote -- this means unsaved local changes exist.
        // Show the conflict dialog so the user can choose.
        setConflict({
          planId: remotePlan.id,
          planName: remotePlan.name,
          localUpdatedAt,
          remoteUpdatedAt,
          remotePlan,
          localPlan,
        });
        return null; // signal that we need user input
      } catch (err) {
        console.error('Conflict check failed, falling back to remote plan', err);
        return remotePlan;
      }
    },
    [],
  );

  /**
   * Resolve the current conflict with the user's choice.
   * Returns the plan to load.
   */
  const resolveConflict = useCallback(
    async (choice: ConflictChoice): Promise<GardenPlanRow | null> => {
      if (!conflict) return null;

      if (choice === 'remote') {
        // User chose remote: overwrite local with remote data
        const remotePlan = conflict.remotePlan;
        await saveLocalGarden({
          id: remotePlan.id,
          name: remotePlan.name,
          settings: remotePlan.plot_settings,
          plants: remotePlan.plants,
          beds: remotePlan.beds,
          updated_at: remotePlan.updated_at,
        } as GardenPlan);
        setConflict(null);
        return remotePlan;
      }

      if (choice === 'local') {
        // User chose local: build a GardenPlanRow-shaped object from the local
        // data so the caller can load it via the normal loadPlan path.
        const local = conflict.localPlan;
        const asRow: GardenPlanRow = {
          ...conflict.remotePlan,
          name: local.name,
          plot_settings: local.settings,
          plants: local.plants,
          beds: local.beds,
          updated_at: local.updated_at,
        };
        setConflict(null);
        return asRow;
      }

      // Cancelled
      setConflict(null);
      return null;
    },
    [conflict],
  );

  const dismissConflict = useCallback(() => {
    setConflict(null);
  }, []);

  return {
    conflict,
    checkForConflict,
    resolveConflict,
    dismissConflict,
  };
}
