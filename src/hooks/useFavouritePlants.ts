import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'allotment-buddy-favourite-plants';

export interface FavouritePlant {
  plantId: string;
  order: number;
}

export function useFavouritePlants() {
  const [favourites, setFavourites] = useState<FavouritePlant[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favourites));
  }, [favourites]);

  const isFavourite = useCallback((plantId: string) => {
    return favourites.some(f => f.plantId === plantId);
  }, [favourites]);

  const toggleFavourite = useCallback((plantId: string) => {
    setFavourites(prev => {
      if (prev.some(f => f.plantId === plantId)) {
        return prev.filter(f => f.plantId !== plantId);
      }
      return [...prev, { plantId, order: prev.length }];
    });
  }, []);

  const reorder = useCallback((fromIndex: number, toIndex: number) => {
    setFavourites(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next.map((f, i) => ({ ...f, order: i }));
    });
  }, []);

  const getFavouriteIds = useCallback(() => {
    return favourites.sort((a, b) => a.order - b.order).map(f => f.plantId);
  }, [favourites]);

  return { favourites, isFavourite, toggleFavourite, reorder, getFavouriteIds };
}
