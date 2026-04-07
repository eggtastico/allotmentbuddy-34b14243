import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'allotment-buddy-favourite-plants';

export interface FavouritePlant {
  plantId: string;
  order: number;
  quantity: number; // desired number of this plant (0 = no limit / auto)
}

export function useFavouritePlants() {
  const [favourites, setFavourites] = useState<FavouritePlant[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      // migrate old entries without quantity
      return parsed.map((f: any) => ({ ...f, quantity: f.quantity ?? 0 }));
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
      return [...prev, { plantId, order: prev.length, quantity: 0 }];
    });
  }, []);

  const setQuantity = useCallback((plantId: string, quantity: number) => {
    setFavourites(prev =>
      prev.map(f => f.plantId === plantId ? { ...f, quantity: Math.max(0, quantity) } : f)
    );
  }, []);

  const getQuantity = useCallback((plantId: string) => {
    return favourites.find(f => f.plantId === plantId)?.quantity ?? 0;
  }, [favourites]);

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

  const getFavouritesWithQuantity = useCallback(() => {
    return [...favourites].sort((a, b) => a.order - b.order);
  }, [favourites]);

  return { favourites, isFavourite, toggleFavourite, reorder, getFavouriteIds, setQuantity, getQuantity, getFavouritesWithQuantity };
}
