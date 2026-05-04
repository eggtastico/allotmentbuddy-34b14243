import { useEffect, useState, useCallback } from "react";
import { updateSyncStatus, getSyncStatus, getPendingSyncItems, markAsSynced, pruneOldSyncItems, SyncQueueItem } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SyncProgress {
  isOnline: boolean;
  isSyncing: boolean;
  pendingChanges: number;
  lastSyncTime?: number;
  lastError?: string;
}

// Helper function to sync a single item to Supabase
async function syncItemToSupabase(item: SyncQueueItem): Promise<void> {
  const { action, entityType, entityId, data } = item;

  switch (entityType) {
    case "garden": {
      if (action === "create" || action === "update") {
        const { error } = await supabase
          .from("garden_plans")
          .upsert(data, { onConflict: "id" });
        if (error) throw error;
      } else if (action === "delete") {
        const { error } = await supabase
          .from("garden_plans")
          .delete()
          .eq("id", entityId);
        if (error) throw error;
      }
      break;
    }

    case "plant": {
      if (action === "create" || action === "update") {
        const { error } = await supabase
          .from("placed_plants")
          .upsert(data, { onConflict: "id" });
        if (error) throw error;
      } else if (action === "delete") {
        const { error } = await supabase
          .from("placed_plants")
          .delete()
          .eq("id", entityId);
        if (error) throw error;
      }
      break;
    }

    case "bed": {
      if (action === "create" || action === "update") {
        const { error } = await supabase
          .from("garden_beds")
          .upsert(data, { onConflict: "id" });
        if (error) throw error;
      } else if (action === "delete") {
        const { error } = await supabase
          .from("garden_beds")
          .delete()
          .eq("id", entityId);
        if (error) throw error;
      }
      break;
    }

    case "photo": {
      if (action === "create") {
        // Photos are stored as blobs - this would need special handling
        // For now, just track metadata
        const photoData = data as Record<string, unknown>;
        const { error } = await supabase
          .from("garden_photos")
          .insert({
            id: entityId,
            garden_id: photoData.gardenId as string,
            plant_id: photoData.plantId as string | null,
            timestamp: photoData.timestamp as number,
            width: photoData.width as number | null,
            height: photoData.height as number | null,
          });
        if (error) throw error;
      } else if (action === "delete") {
        const { error } = await supabase
          .from("garden_photos")
          .delete()
          .eq("id", entityId);
        if (error) throw error;
      }
      break;
    }

    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

export function useOfflineSync() {
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingChanges: 0,
  });

  const checkSyncStatus = useCallback(async () => {
    const status = await getSyncStatus();
    if (status) {
      setSyncProgress({
        isOnline: status.isOnline,
        isSyncing: false,
        pendingChanges: status.pendingChanges,
        lastSyncTime: status.lastSyncTime,
        lastError: status.lastError,
      });
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if (syncProgress.isSyncing || !syncProgress.isOnline) {
      return;
    }

    setSyncProgress((prev) => ({ ...prev, isSyncing: true }));

    try {
      const pendingItems = await getPendingSyncItems();

      if (pendingItems.length === 0) {
        setSyncProgress((prev) => ({ ...prev, isSyncing: false }));
        return;
      }

      let syncedCount = 0;
      let failedCount = 0;
      let lastError: string | undefined;

      // Sync each item to Supabase
      for (const item of pendingItems) {
        try {
          await syncItemToSupabase(item);
          if (item.id) {
            await markAsSynced(item.id);
            syncedCount++;
          }
        } catch (itemError) {
          const errorMsg = itemError instanceof Error ? itemError.message : "Unknown error";
          console.error(`Failed to sync ${item.entityType} ${item.entityId}:`, itemError);
          lastError = errorMsg;
          failedCount++;
        }
      }

      // Update progress based on results
      if (failedCount > 0) {
        const message = `Synced ${syncedCount}/${pendingItems.length}. ${failedCount} failed.`;
        toast.error(message);
        setSyncProgress((prev) => ({
          ...prev,
          isSyncing: false,
          pendingChanges: failedCount,
          lastError: lastError,
          lastSyncTime: Date.now(),
        }));
        await updateSyncStatus({
          lastError: lastError,
          pendingChanges: failedCount,
          lastSyncTime: Date.now(),
        });
      } else {
        toast.success(`Synced ${syncedCount} changes`);
        setSyncProgress((prev) => ({
          ...prev,
          isSyncing: false,
          pendingChanges: 0,
          lastSyncTime: Date.now(),
        }));
        await updateSyncStatus({
          lastSyncTime: Date.now(),
          pendingChanges: 0,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Sync failed";
      console.error("Sync error:", error);
      toast.error(`Sync failed: ${errorMessage}`);
      setSyncProgress((prev) => ({
        ...prev,
        isSyncing: false,
        lastError: errorMessage,
      }));

      await updateSyncStatus({
        lastError: errorMessage,
      });
    }
  }, [syncProgress.isSyncing, syncProgress.isOnline]);

  // Update online/offline status
  useEffect(() => {
    const handleOnline = async () => {
      setSyncProgress((prev) => ({ ...prev, isOnline: true }));
      await updateSyncStatus({ isOnline: true });
      // Trigger sync when coming back online
      await triggerSync();
    };

    const handleOffline = async () => {
      setSyncProgress((prev) => ({ ...prev, isOnline: false }));
      await updateSyncStatus({ isOnline: false });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Check sync status on mount and prune stale queue items (older than 7 days)
    checkSyncStatus();
    pruneOldSyncItems().catch(console.error);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [checkSyncStatus, triggerSync]);

  return {
    ...syncProgress,
    checkSyncStatus,
    triggerSync,
  };
}

// Hook to detect online/offline status
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
