import { useRef, useState, useCallback } from 'react';

export interface CameraError {
  code: string;
  message: string;
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<CameraError | null>(null);
  const [isFacingFront, setIsFacingFront] = useState(true);

  const startCamera = useCallback(async (facingMode: 'user' | 'environment' = 'user') => {
    setError(null);
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current?.play();
            setIsActive(true);
          } catch (playError) {
            console.error('Video play failed:', playError);
            setError({
              code: 'PlaybackError',
              message: 'Camera stream loaded but could not play video. Try refreshing the page.',
            });
          }
        };

        // Fallback: try to play immediately as well
        videoRef.current.play().catch(err => {
          console.error('Immediate play attempt failed:', err);
        });
      }

      setIsFacingFront(facingMode === 'user');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access camera';
      const code = err instanceof DOMException ? err.name : 'UNKNOWN';

      setError({
        code,
        message: getCameraErrorMessage(code, errorMessage),
      });
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsActive(false);
  }, []);

  const toggleCamera = useCallback(async () => {
    if (isActive) {
      stopCamera();
    } else {
      const nextFacingMode = isFacingFront ? 'environment' : 'user';
      await startCamera(nextFacingMode);
    }
  }, [isActive, isFacingFront, startCamera, stopCamera]);

  const switchCamera = useCallback(async () => {
    stopCamera();
    const nextFacingMode = isFacingFront ? 'environment' : 'user';
    await startCamera(nextFacingMode);
  }, [isFacingFront, startCamera, stopCamera]);

  const capturePhoto = useCallback(
    (targetWidth: number = 1280, targetHeight: number = 720): Promise<string | null> => {
      return new Promise((resolve) => {
        if (!videoRef.current || !canvasRef.current || !isActive) {
          resolve(null);
          return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(null);
          return;
        }

        // Set canvas size to match video dimensions
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0);

        // Convert to base64 data URL
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl);
      });
    },
    [isActive]
  );

  const compressImage = useCallback(async (dataUrl: string, maxWidth: number = 1024, maxHeight: number = 1024, quality: number = 0.7): Promise<string> => {
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

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      };

      img.onerror = () => {
        resolve(dataUrl); // Return original if compression fails
      };
    });
  }, []);

  return {
    videoRef,
    canvasRef,
    isActive,
    error,
    isFacingFront,
    startCamera,
    stopCamera,
    toggleCamera,
    switchCamera,
    capturePhoto,
    compressImage,
  };
}

function getCameraErrorMessage(code: string, message: string): string {
  switch (code) {
    case 'NotAllowedError':
      return 'Camera permission was denied. Please allow access in your browser settings.';
    case 'NotFoundError':
      return 'No camera device found on your device.';
    case 'NotReadableError':
      return 'Camera is in use by another application.';
    case 'SecurityError':
      return 'Camera access is not allowed due to security restrictions.';
    case 'OverconstrainedError':
      return 'The requested camera constraints could not be satisfied.';
    default:
      return message || 'Failed to access camera.';
  }
}
