import { useEffect, useState } from 'react';
import { useCamera } from '@/hooks/useCamera';
import { compressImage } from '@/lib/photoStorage';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Camera, RotateCw, X, Check, Loader2 } from 'lucide-react';

interface CameraCapturProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (photoDataUrl: string) => void;
  title?: string;
  description?: string;
}

export function CameraCapture({
  isOpen,
  onClose,
  onCapture,
  title = 'Take a Photo',
  description = 'Capture a photo of your plant or garden',
}: CameraCapturProps) {
  const {
    videoRef,
    canvasRef,
    isActive,
    error,
    isFacingFront,
    startCamera,
    stopCamera,
    switchCamera,
    capturePhoto,
  } = useCamera();

  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      startCamera('environment');
    } else {
      stopCamera();
      setCapturedPhoto(null);
    }
  }, [isOpen, startCamera, stopCamera]);

  const handleCapture = async () => {
    setIsCapturing(true);
    try {
      const photo = await capturePhoto();
      if (photo) {
        // Compress the image
        const compressed = await compressImage(photo, 1024, 1024, 0.8);
        setCapturedPhoto(compressed);
      }
    } catch (error) {
      console.error('Capture failed:', error);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    startCamera(isFacingFront ? 'user' : 'environment');
  };

  const handleConfirm = async () => {
    if (!capturedPhoto) return;
    setIsProcessing(true);
    try {
      onCapture(capturedPhoto);
      setCapturedPhoto(null);
      stopCamera();
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setCapturedPhoto(null);
    stopCamera();
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-2xl w-full">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {!capturedPhoto ? (
            <>
              {/* Camera view */}
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  autoPlay
                  muted
                />
                <canvas ref={canvasRef} className="hidden" />

                {error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                    <div className="text-center">
                      <p className="text-white font-medium mb-2">📷 Camera Error</p>
                      <p className="text-red-400 text-sm">{error.message}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Camera controls */}
              <div className="flex gap-2 justify-center">
                <Button
                  onClick={switchCamera}
                  disabled={!isActive || isCapturing}
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  <RotateCw className="w-4 h-4" />
                  Switch Camera
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Photo preview */}
              <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-video">
                <img
                  src={capturedPhoto}
                  alt="Captured"
                  className="w-full h-full object-contain"
                />
              </div>
            </>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>Cancel</AlertDialogCancel>

          {!capturedPhoto ? (
            <Button
              onClick={handleCapture}
              disabled={!isActive || isCapturing}
              className="gap-2"
            >
              {isCapturing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Capturing...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  Capture Photo
                </>
              )}
            </Button>
          ) : (
            <>
              <Button
                onClick={handleRetake}
                disabled={isProcessing}
                variant="outline"
              >
                Retake
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isProcessing}
                className="gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Use Photo
                  </>
                )}
              </Button>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
