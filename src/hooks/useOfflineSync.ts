import { useEffect, useState, useCallback } from "react";
import { updateSyncStatus, getSyncStatus, getPendingSyncItems, markAsSynced } from "@/lib/db";

export interface SyncProgress {
  isOnline: boolean;
  isSyncing: boolean;
  pendingChanges: number;
  lastSyncTime?: number;
  lastError?: string;
}

export function useOfflineSync() {
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingChanges: 0,
  });

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

    // Check sync status on mount
    checkSyncStatus();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

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

      // In a real app, this would call your Supabase API
      // For now, we'll simulate successful syncing
      for (const item of pendingItems) {
        if (item.id) {
          await markAsSynced(item.id);
        }
      }

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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Sync failed";
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
