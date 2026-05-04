import Dexie, { Table } from "dexie";
import { GardenPlan, PlacedPlant, GardenBed, HarvestLog, PestLog } from "@/types/garden";
import { generateId } from "./uuid";

export interface Photo {
  id: string;
  gardenId: string;
  plantId?: string;
  data: Blob; // Photo blob data
  timestamp: number;
  width?: number;
  height?: number;
}

export interface SyncQueueItem {
  id?: number;
  action: "create" | "update" | "delete";
  entityType: "garden" | "plant" | "bed" | "photo";
  entityId: string;
  data: GardenPlan | PlacedPlant | GardenBed | Photo | Record<string, unknown>;
  timestamp: number;
  retryCount?: number;
  lastError?: string;
}

export interface SyncStatus {
  id?: number;
  lastSyncTime: number;
  pendingChanges: number;
  isOnline: boolean;
  lastError?: string;
}

export class AllotmentBuddyDB extends Dexie {
  gardens!: Table<GardenPlan>;
  plants!: Table<PlacedPlant>;
  beds!: Table<GardenBed>;
  photos!: Table<Photo>;
  syncQueue!: Table<SyncQueueItem>;
  syncStatus!: Table<SyncStatus>;
  harvestLogs!: Table<HarvestLog>;
  pestLogs!: Table<PestLog>;

  constructor() {
    super("AllotmentBuddyDB");
    this.version(1).stores({
      gardens: "id",
      plants: "id, plantId",
      beds: "id",
      photos: "id, gardenId, plantId",
      syncQueue: "++id, timestamp",
      syncStatus: "id",
    });
    this.version(2).stores({
      gardens: "id, updated_at",
      plants: "id, plantId",
      beds: "id",
      photos: "id, gardenId, plantId",
      syncQueue: "++id, timestamp",
      syncStatus: "id",
    });
    this.version(3).stores({
      gardens: "id, updated_at",
      plants: "id, plantId",
      beds: "id",
      photos: "id, gardenId, plantId",
      syncQueue: "++id, timestamp",
      syncStatus: "id",
      harvestLogs: "id, gardenId, plantId, harvestDate",
      pestLogs: "id, gardenId, plantId, logDate, resolved",
    });
  }
}

export const db = new AllotmentBuddyDB();

// Initialize sync status on first load
export async function initializeSyncStatus() {
  const existing = await db.syncStatus.toArray();
  if (existing.length === 0) {
    await db.syncStatus.add({
      id: 1, // Use fixed id for singleton status object
      lastSyncTime: Date.now(),
      pendingChanges: 0,
      isOnline: navigator.onLine,
    });
  }
}

// Get all gardens from local database
export async function getLocalGardens(): Promise<GardenPlan[]> {
  return db.gardens.toArray();
}

// Get a specific garden from local database
export async function getLocalGarden(id: string): Promise<GardenPlan | undefined> {
  return db.gardens.get(id);
}

// Save garden to local database
export async function saveLocalGarden(garden: GardenPlan): Promise<string> {
  const gardenWithTimestamp = {
    ...garden,
    updated_at: garden.updated_at || new Date().toISOString(),
  };
  return db.gardens.put(gardenWithTimestamp);
}

// Delete garden from local database
export async function deleteLocalGarden(id: string): Promise<void> {
  await db.gardens.delete(id);
  await db.syncQueue.add({
    action: "delete",
    entityType: "garden",
    entityId: id,
    data: null,
    timestamp: Date.now(),
  });
}

// Save photo to local database
export async function saveLocalPhoto(photo: Omit<Photo, "id">): Promise<string> {
  const id = generateId();
  await db.photos.put({ ...photo, id });
  await db.syncQueue.add({
    action: "create",
    entityType: "photo",
    entityId: id,
    data: {
      gardenId: photo.gardenId,
      plantId: photo.plantId,
      timestamp: photo.timestamp,
      width: photo.width,
      height: photo.height,
    },
    timestamp: Date.now(),
  });
  return id;
}

// Get photos for a garden
export async function getLocalPhotos(gardenId: string): Promise<Photo[]> {
  return db.photos.where("gardenId").equals(gardenId).toArray();
}

// Get photos for a specific plant
export async function getLocalPhotosByPlant(plantId: string): Promise<Photo[]> {
  return db.photos.where("plantId").equals(plantId).toArray();
}

// Delete photo from local database
export async function deleteLocalPhoto(id: string): Promise<void> {
  const photo = await db.photos.get(id);
  if (photo) {
    await db.photos.delete(id);
    await db.syncQueue.add({
      action: "delete",
      entityType: "photo",
      entityId: id,
      data: null,
      timestamp: Date.now(),
    });
  }
}

// Queue a change for syncing — returns the auto-increment id so callers can mark it synced later
export async function queueSyncItem(item: Omit<SyncQueueItem, "timestamp" | "retryCount">): Promise<number> {
  const id = await db.syncQueue.add({
    ...item,
    timestamp: Date.now(),
    retryCount: 0,
  });

  // Update sync status to reflect pending changes
  const syncStatus = await db.syncStatus.toArray();
  if (syncStatus.length > 0) {
    await db.syncStatus.update(syncStatus[0].id!, {
      pendingChanges: syncStatus[0].pendingChanges + 1,
    });
  }
  return id as number;
}

// Remove sync queue items older than maxAgeMs (default 7 days) that never succeeded
export async function pruneOldSyncItems(maxAgeMs = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  const cutoff = Date.now() - maxAgeMs;
  const oldItems = await db.syncQueue.where('timestamp').below(cutoff).toArray();
  if (oldItems.length === 0) return;
  await db.syncQueue.bulkDelete(oldItems.map(i => i.id!));
  // Reconcile the pending count
  const syncStatus = await db.syncStatus.toArray();
  if (syncStatus.length > 0) {
    await db.syncStatus.update(syncStatus[0].id!, {
      pendingChanges: Math.max(0, syncStatus[0].pendingChanges - oldItems.length),
    });
  }
}

// Get pending sync items
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  return db.syncQueue.toArray();
}

// Mark item as synced (remove from queue)
export async function markAsSynced(id: number): Promise<void> {
  await db.syncQueue.delete(id);

  // Update sync status
  const syncStatus = await db.syncStatus.toArray();
  if (syncStatus.length > 0) {
    await db.syncStatus.update(syncStatus[0].id!, {
      pendingChanges: Math.max(0, syncStatus[0].pendingChanges - 1),
      lastSyncTime: Date.now(),
    });
  }
}

// Update sync status
export async function updateSyncStatus(updates: Partial<Omit<SyncStatus, "id">>): Promise<void> {
  const syncStatus = await db.syncStatus.toArray();
  if (syncStatus.length > 0) {
    await db.syncStatus.update(syncStatus[0].id!, {
      ...updates,
      lastSyncTime: updates.lastSyncTime || Date.now(),
    });
  }
}

// Get sync status
export async function getSyncStatus(): Promise<SyncStatus | undefined> {
  const statuses = await db.syncStatus.toArray();
  return statuses[0];
}

// Clear all data (for dev/testing)
export async function clearAllData(): Promise<void> {
  await db.delete();
  await db.open();
}

// ── Harvest Logs ─────────────────────────────────────────────────────────────

export async function saveHarvestLog(log: Omit<HarvestLog, 'id'>): Promise<string> {
  const id = generateId();
  await db.harvestLogs.put({ ...log, id });
  return id;
}

export async function getHarvestLogs(gardenId: string): Promise<HarvestLog[]> {
  return db.harvestLogs.where('gardenId').equals(gardenId).toArray();
}

export async function getHarvestLogsByPlant(gardenId: string, plantId: string): Promise<HarvestLog[]> {
  return db.harvestLogs
    .where('gardenId').equals(gardenId)
    .and(log => log.plantId === plantId)
    .toArray();
}

export async function updateHarvestLog(id: string, changes: Partial<Omit<HarvestLog, 'id'>>): Promise<void> {
  await db.harvestLogs.update(id, changes);
}

export async function deleteHarvestLog(id: string): Promise<void> {
  await db.harvestLogs.delete(id);
}

// ── Pest / Disease Logs ───────────────────────────────────────────────────────

export async function savePestLog(log: Omit<PestLog, 'id'>): Promise<string> {
  const id = generateId();
  await db.pestLogs.put({ ...log, id });
  return id;
}

export async function getPestLogs(gardenId: string): Promise<PestLog[]> {
  return db.pestLogs.where('gardenId').equals(gardenId).toArray();
}

export async function getUnresolvedPestLogs(gardenId: string): Promise<PestLog[]> {
  return db.pestLogs
    .where('gardenId').equals(gardenId)
    .and(log => !log.resolved)
    .toArray();
}

export async function updatePestLog(id: string, changes: Partial<Omit<PestLog, 'id'>>): Promise<void> {
  await db.pestLogs.update(id, changes);
}

export async function deletePestLog(id: string): Promise<void> {
  await db.pestLogs.delete(id);
}
