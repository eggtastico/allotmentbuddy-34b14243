import { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface PhotoLightboxProps {
  images: string[]; // Array of image URLs (already signed URLs)
  initialIndex: number;
  onClose: () => void;
  captions?: string[];
}

export function PhotoLightbox({ images, initialIndex, onClose, captions }: PhotoLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);

  if (images.length === 0) return null;

  const currentImage = images[currentIndex];
  const currentCaption = captions?.[currentIndex];

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft') handlePrev();
    if (e.key === 'ArrowRight') handleNext();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label="Photo viewer"
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-lg bg-black/50 hover:bg-black/70 transition-colors"
        aria-label="Close"
      >
        <X className="h-6 w-6 text-white" />
      </button>

      {/* Main image */}
      <div className="flex-1 flex items-center justify-center w-full" onClick={(e) => e.stopPropagation()}>
        <div className={`relative ${isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`} onClick={() => setIsZoomed(!isZoomed)}>
          <img
            src={currentImage}
            alt={currentCaption || `Photo ${currentIndex + 1}`}
            className={`max-h-[70vh] max-w-[90vw] object-contain rounded-lg transition-transform ${
              isZoomed ? 'scale-150' : 'scale-100'
            }`}
          />
        </div>
      </div>

      {/* Caption */}
      {currentCaption && (
        <div className="mt-4 text-center text-white text-sm max-w-[80vw]">{currentCaption}</div>
      )}

      {/* Navigation */}
      <div className="mt-4 flex items-center gap-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePrev();
          }}
          className="p-2 rounded-lg bg-black/50 hover:bg-black/70 transition-colors disabled:opacity-50"
          aria-label="Previous photo"
        >
          <ChevronLeft className="h-6 w-6 text-white" />
        </button>

        <div className="text-white text-sm font-medium">
          {currentIndex + 1} / {images.length}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          className="p-2 rounded-lg bg-black/50 hover:bg-black/70 transition-colors disabled:opacity-50"
          aria-label="Next photo"
        >
          <ChevronRight className="h-6 w-6 text-white" />
        </button>
      </div>

      {/* Keyboard hint */}
      <div className="mt-4 text-xs text-gray-400 text-center">
        Press ← → to navigate, ESC to close, or click to zoom
      </div>
    </div>
  );
}
