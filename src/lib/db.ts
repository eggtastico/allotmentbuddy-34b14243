import Dexie, { Table } from "dexie";
import { GardenPlan, PlacedPlant, GardenBed } from "@/types/garden";
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
  return db.gardens.put(garden);
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

// Queue a change for syncing
export async function queueSyncItem(item: Omit<SyncQueueItem, "timestamp" | "retryCount">): Promise<void> {
  await db.syncQueue.add({
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
