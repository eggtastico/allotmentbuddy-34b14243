import { useState, useEffect, useCallback } from 'react';
import { Location } from '@/types/garden';

export interface LocationError {
  code: number;
  message: string;
}

export function useLocation() {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<LocationError | null>(null);
  const [loading, setLoading] = useState(false);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError({
        code: 0,
        message: 'Geolocation is not supported by your browser',
      });
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setLocation({
          lat: latitude,
          lng: longitude,
          accuracy,
          timestamp: Date.now(),
        });
        setLoading(false);

        // Try to get address from coordinates (using Nominatim reverse geocoding)
        reverseGeocode(latitude, longitude)
          .then((address) => {
            setLocation((prev) =>
              prev ? { ...prev, address } : null
            );
          })
          .catch(console.error);
      },
      (err) => {
        setError({
          code: err.code,
          message: getGeolocationErrorMessage(err.code),
        });
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes cache
      }
    );
  }, []);

  const watchLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError({
        code: 0,
        message: 'Geolocation is not supported',
      });
      return () => {};
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setLocation({
          lat: latitude,
          lng: longitude,
          accuracy,
          timestamp: Date.now(),
        });
        setError(null);
      },
      (err) => {
        setError({
          code: err.code,
          message: getGeolocationErrorMessage(err.code),
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return {
    location,
    error,
    loading,
    getLocation,
    watchLocation,
  };
}

// Helper function to get user-friendly error messages
function getGeolocationErrorMessage(code: number): string {
  switch (code) {
    case 1:
      return 'Permission denied. Please enable location access in your browser settings.';
    case 2:
      return 'Position unavailable. Please check your location settings.';
    case 3:
      return 'Request timed out. Please try again.';
    default:
      return 'An unknown error occurred while getting your location.';
  }
}

// Cache for reverse geocoding results
const reverseGeocodeCache = new Map<string, { result: string; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

// Reverse geocoding using Nominatim (OpenStreetMap)
// Returns address string from lat/lng coordinates
// Includes caching to avoid rate limits (1 req/sec limit)
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const cached = reverseGeocodeCache.get(cacheKey);

    // Return cached result if still fresh
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.result;
    }

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AllotmentBuddy/1.0',
        },
      }
    );

    if (!response.ok) {
      // Don't throw on rate limit, just return empty
      if (response.status === 429) {
        console.warn('Nominatim rate limit hit - will retry later');
        return '';
      }
      throw new Error('Geocoding failed');
    }

    const data = await response.json();
    const result = data.address?.city || data.address?.town || data.address?.county || '';

    // Cache the result
    reverseGeocodeCache.set(cacheKey, { result, timestamp: Date.now() });

    return result;
  } catch (error) {
    // Silently fail - location is still available even without address
    console.error('Reverse geocoding failed:', error);
    return '';
  }
}

// Calculate frost dates based on latitude
export function calculateFrostDates(
  latitude: number
): { lastSpringFrost: string; firstFallFrost: string } {
  // Approximate formula based on latitude
  // This is a simplified calculation - real data would come from a service
  // Spring frost date (approximate)
  const daysFromMarch1 = Math.max(0, 100 - Math.abs(latitude) * 1.5);
  const lastSpringFrost = new Date(new Date().getFullYear(), 2, 1);
  lastSpringFrost.setDate(lastSpringFrost.getDate() + daysFromMarch1);

  // Fall frost date (approximate)
  const daysFromSeptember1 = Math.max(0, 180 + Math.abs(latitude) * 1.2);
  const firstFallFrost = new Date(new Date().getFullYear(), 8, 1);
  firstFallFrost.setDate(firstFallFrost.getDate() + daysFromSeptember1);

  return {
    lastSpringFrost: lastSpringFrost.toISOString().split('T')[0],
    firstFallFrost: firstFallFrost.toISOString().split('T')[0],
  };
}

// Get sunrise and sunset times based on latitude and day of year
export function calculateSunTimes(
  latitude: number,
  dayOfYear: number = new Date().getDay()
): { sunrise: string; sunset: string } {
  // Simplified calculation
  const lat = (latitude * Math.PI) / 180;

  // Declination of the sun (simplified)
  const declination = (Math.PI / 180) * 23.44 * Math.cos((2 * Math.PI * (dayOfYear + 10)) / 365.25);

  // Hour angle for sunrise/sunset
  const cosH = -Math.tan(lat) * Math.tan(declination);
  const h = Math.acos(Math.max(-1, Math.min(1, cosH)));

  const sunrise = 12 - (h * 180) / (Math.PI * 15);
  const sunset = 12 + (h * 180) / (Math.PI * 15);

  const formatTime = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  return {
    sunrise: formatTime(sunrise),
    sunset: formatTime(sunset),
  };
}
