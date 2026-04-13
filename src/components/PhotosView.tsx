import { PlacedPlant } from '@/types/garden';

interface PhotosViewProps {
  plants: PlacedPlant[];
}

export function PhotosView({ plants }: PhotosViewProps) {
  const plantsWithPhotos = plants.filter((p) => p.photos && p.photos.length > 0);

  if (plantsWithPhotos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen py-12 px-4 text-center">
        <div className="text-6xl mb-4">📷</div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          No Photos Yet
        </h2>
        <p className="text-muted-foreground mb-6">
          Take photos of your plants to track their growth and health
        </p>
        <p className="text-sm text-muted-foreground">
          Tap on a plant in the garden view and click the camera icon to start
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-2xl font-semibold text-foreground sticky top-0 bg-background py-2 z-10">
        📷 Plant Photos
      </h2>

      {plantsWithPhotos.map((plant) => (
        <div key={plant.id} className="space-y-2">
          <h3 className="font-medium text-foreground">{plant.plantId}</h3>
          <div className="grid grid-cols-3 gap-2">
            {plant.photos?.map((photo) => (
              <div
                key={photo.id}
                className="aspect-square rounded-lg overflow-hidden bg-gray-200"
              >
                <img
                  src={photo.dataUrl}
                  alt="Plant photo"
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {plant.photos?.length} photo{plant.photos && plant.photos.length !== 1 ? 's' : ''}
          </p>
        </div>
      ))}
    </div>
  );
}
