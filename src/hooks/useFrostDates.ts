import { useMemo } from 'react';
import { getFrostDates, FrostDates } from '@/utils/frostDateCalculator';

interface LocationData {
  lat: number;
  lon: number;
  name?: string;
}

/**
 * Hook that calculates frost dates for a given location
 * Memoized so it only recalculates when location changes
 */
export function useFrostDates(location: LocationData | null): FrostDates | null {
  return useMemo(() => {
    if (!location) return null;
    return getFrostDates(location.lat, location.lon);
  }, [location?.lat, location?.lon]);
}
