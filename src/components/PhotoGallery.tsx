import { useState } from 'react';
import { Trash2, ZoomIn } from 'lucide-react';
import { PlantPhoto } from '@/types/garden';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface PhotoGalleryProps {
  // Support both old and new formats
  photos?: PlantPhoto[];
  images?: string[];
  onImagesChange?: (images: string[]) => void;
  onImageDelete?: (id: string | number) => void;
  onPhotosChange?: (photos: PlantPhoto[]) => void;
  readOnly?: boolean;
}

export function PhotoGallery({
  photos,
  images = [],
  onImagesChange,
  onImageDelete,
  onPhotosChange,
  readOnly = false,
}: PhotoGalleryProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<PlantPhoto | string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | number | null>(null);

  const photoArray = photos || images.map((img, idx) => ({
    id: `img-${idx}`,
    dataUrl: img,
    timestamp: Date.now(),
  }));

  if (photoArray.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        📷 No photos yet
      </div>
    );
  }

  const handleDelete = (id: string | number) => {
    if (readOnly) return;
    if (onImageDelete) {
      onImageDelete(id);
    } else if (onPhotosChange && photos) {
      const updated = photos.filter((p) => p.id !== id);
      onPhotosChange(updated);
    } else if (onImagesChange) {
      const index = typeof id === 'number' ? id : parseInt(id.toString().split('-')[1]);
      const updated = images.filter((_, i) => i !== index);
      onImagesChange(updated);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {photoArray.map((photo, index) => {
          const isPhotoObj = 'dataUrl' in photo;
          const dataUrl = isPhotoObj ? photo.dataUrl : photo;
          const id = isPhotoObj ? photo.id : index;

          return (
            <div
              key={id}
              className="relative aspect-square rounded-md overflow-hidden bg-gray-100 group cursor-pointer"
              onClick={() => setSelectedPhoto(photo)}
            >
              <img
                src={dataUrl}
                alt="Plant photo"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPhoto(photo);
                  }}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
                  title="View"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                {!readOnly && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmId(id);
                    }}
                    className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-white transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Photo viewer modal */}
      {selectedPhoto && (
        <AlertDialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
          <AlertDialogContent className="max-w-4xl w-full max-h-[90vh]">
            <AlertDialogHeader>
              <AlertDialogTitle>Photo Details</AlertDialogTitle>
            </AlertDialogHeader>

            <div className="flex flex-col items-center justify-center py-4">
              <img
                src={typeof selectedPhoto === 'string' ? selectedPhoto : selectedPhoto.dataUrl}
                alt="Plant photo"
                className="max-w-full max-h-[60vh] rounded-lg object-contain"
              />
              {typeof selectedPhoto === 'object' && (
                <div className="mt-4 text-xs text-muted-foreground">
                  <p>📅 {new Date(selectedPhoto.timestamp).toLocaleString()}</p>
                  {selectedPhoto.width && selectedPhoto.height && (
                    <p>📐 {selectedPhoto.width}x{selectedPhoto.height}px</p>
                  )}
                </div>
              )}
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
              {!readOnly && (
                <Button
                  onClick={() => {
                    const id =
                      typeof selectedPhoto === 'string'
                        ? photoArray.indexOf(selectedPhoto)
                        : selectedPhoto.id;
                    setDeleteConfirmId(id);
                    setSelectedPhoto(null);
                  }}
                  variant="destructive"
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirmId !== null && (
        <AlertDialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Photo?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. The photo will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  handleDelete(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
