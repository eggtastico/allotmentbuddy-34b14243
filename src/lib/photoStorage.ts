import { db, Photo, saveLocalPhoto, deleteLocalPhoto } from '@/lib/db';
import { PlantPhoto } from '@/types/garden';
import { supabase } from '@/integrations/supabase/client';

const PHOTO_BUCKET = 'garden-photos';

/**
 * Convert data URL to blob for efficient storage
 */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

/**
 * Convert blob to data URL for display
 */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Compress an image data URL
 */
export async function compressImage(
  dataUrl: string,
  maxWidth: number = 1024,
  maxHeight: number = 1024,
  quality: number = 0.7
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      // Calculate new dimensions
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve(compressed);
    };

    img.onerror = () => {
      resolve(dataUrl);
    };
  });
}

/**
 * Generate thumbnail from image data URL
 */
export async function generateThumbnail(
  dataUrl: string,
  size: number = 200
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      canvas.width = size;
      canvas.height = size;

      // Calculate crop box to maintain aspect ratio
      const dimension = Math.min(img.width, img.height);
      const sx = (img.width - dimension) / 2;
      const sy = (img.height - dimension) / 2;

      ctx.drawImage(img, sx, sy, dimension, dimension, 0, 0, size, size);
      const thumbnail = canvas.toDataURL('image/jpeg', 0.6);
      resolve(thumbnail);
    };

    img.onerror = () => {
      resolve(dataUrl);
    };
  });
}

/**
 * Get image dimensions from data URL
 */
export async function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
    };
  });
}

/**
 * Upload a photo to Supabase Storage (non-blocking, best-effort).
 * Falls back silently if offline or unauthenticated.
 */
async function uploadToCloud(
  photoId: string,
  gardenId: string,
  blob: Blob
): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const path = `${user.id}/${gardenId}/${photoId}.jpg`;
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg', upsert: true });

    if (error) {
      console.warn('Cloud photo upload failed:', error.message);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from(PHOTO_BUCKET)
      .getPublicUrl(path);

    return urlData.publicUrl;
  } catch {
    return null;
  }
}

/**
 * Delete a photo from Supabase Storage (best-effort).
 */
async function deleteFromCloud(
  photoId: string,
  gardenId: string
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const path = `${user.id}/${gardenId}/${photoId}.jpg`;
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
  } catch {
    // Non-critical — photo will be orphaned in storage
  }
}

/**
 * Save a photo to IndexedDB and upload to Supabase Storage.
 */
export async function savePhoto(
  gardenId: string,
  plantId: string | undefined,
  photoDataUrl: string
): Promise<string | null> {
  try {
    const blob = await dataUrlToBlob(photoDataUrl);
    const { width, height } = await getImageDimensions(photoDataUrl);

    const id = await saveLocalPhoto({
      gardenId,
      plantId,
      data: blob,
      timestamp: Date.now(),
      width,
      height,
    });

    // Upload to cloud in the background (non-blocking)
    if (id) {
      uploadToCloud(id, gardenId, blob).catch(() => {});
    }

    return id;
  } catch (error) {
    console.error('Failed to save photo:', error);
    return null;
  }
}

/**
 * Delete a photo from IndexedDB and Supabase Storage.
 */
export async function deletePhoto(photoId: string, gardenId?: string): Promise<void> {
  try {
    await deleteLocalPhoto(photoId);
    if (gardenId) {
      deleteFromCloud(photoId, gardenId).catch(() => {});
    }
  } catch (error) {
    console.error('Failed to delete photo:', error);
  }
}

/**
 * Get a photo URL from Supabase Storage.
 * Useful for loading photos on a new device that doesn't have IndexedDB data.
 */
export async function getCloudPhotoUrl(
  userId: string,
  gardenId: string,
  photoId: string
): Promise<string | null> {
  try {
    const path = `${userId}/${gardenId}/${photoId}.jpg`;
    const { data } = supabase.storage
      .from(PHOTO_BUCKET)
      .getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
}

/**
 * Get storage quota information
 */
export async function getStorageQuota(): Promise<{
  usage: number;
  quota: number;
  percentage: number;
}> {
  try {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
      percentage: ((estimate.usage || 0) / (estimate.quota || 1)) * 100,
    };
  } catch {
    return { usage: 0, quota: 0, percentage: 0 };
  }
}

/**
 * Check if storage quota is sufficient for a photo
 */
export async function checkStorageQuota(minAvailable: number = 1024 * 1024): Promise<boolean> {
  const quota = await getStorageQuota();
  return quota.quota - quota.usage > minAvailable;
}

/**
 * Get total photo size for storage estimation
 */
export function estimatePhotoSize(dataUrl: string): number {
  // Base64 encoded data is ~33% larger than binary
  const base64Length = dataUrl.length - dataUrl.indexOf(',') - 1;
  return Math.ceil((base64Length * 3) / 4);
}

/**
 * Convert PlantPhoto to displayable format
 */
export async function photoToDisplayable(photo: Photo): Promise<PlantPhoto> {
  const dataUrl = await blobToDataUrl(photo.data);
  return {
    id: photo.id,
    dataUrl,
    timestamp: photo.timestamp,
    width: photo.width,
    height: photo.height,
  };
}
