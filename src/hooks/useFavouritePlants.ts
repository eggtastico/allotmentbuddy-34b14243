import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { FavouritePlantsResponseSchema } from '@/lib/schemas';
import { z } from 'zod';

const STORAGE_KEY = 'allotment-buddy-favourite-plants';

export interface FavouritePlant {
  plantId: string;
  order: number;
  quantity: number;
}

function loadFromStorage(): FavouritePlant[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.map((f: unknown) => {
      if (typeof f !== 'object' || f === null) return null;
      const row = f as { plantId?: string; plant_id?: string; order?: number; quantity?: number };
      return {
        plantId: row.plantId || row.plant_id || '',
        order: row.order ?? 0,
        quantity: row.quantity ?? 0,
      };
    }).filter((f) => f !== null && f.plantId) : [];
  } catch (err) {
    console.error('Failed to parse stored favourite plants:', err);
    return [];
  }
}

export function useFavouritePlants() {
  const { user } = useAuth();
  const [favourites, setFavourites] = useState<FavouritePlant[]>(loadFromStorage);

  // When user logs in: load their favourites from Supabase.
  // If they have none stored yet, migrate whatever is in localStorage.
  useEffect(() => {
    if (!user) return;

    supabase
      .from('favourite_plants')
      .select('plant_id, order, quantity')
      .eq('user_id', user.id)
      .order('order', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to load favourite plants:', error);
          return;
        }

        if (data && data.length > 0) {
          try {
            const validated = FavouritePlantsResponseSchema.parse(data);
            setFavourites(validated.map(row => ({
              plantId: row.plant_id,
              order: row.order,
              quantity: row.quantity,
            })));
          } catch (parseError) {
            console.error('Failed to parse favourite plants data:', parseError);
          }
        } else {
          // First login — migrate localStorage to Supabase
          const local = loadFromStorage();
          if (local.length > 0) {
            supabase
              .from('favourite_plants')
              .insert(local.map(f => ({
                user_id: user.id,
                plant_id: f.plantId,
                order: f.order,
                quantity: f.quantity,
              })))
              .then(() => {})
              .catch(err => console.error('Failed to migrate favourite plants:', err));
          }
          // Local state already correct — nothing to update
        }
      })
      .catch(err => console.error('Unexpected error loading favourite plants:', err));
  }, [user]);

  // Always keep localStorage in sync so the app works when logged out too
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favourites));
  }, [favourites]);

  const isFavourite = useCallback(
    (plantId: string) => favourites.some(f => f.plantId === plantId),
    [favourites],
  );

  const toggleFavourite = useCallback(
    (plantId: string) => {
      setFavourites(prev => {
        if (prev.some(f => f.plantId === plantId)) {
          if (user) {
            supabase
              .from('favourite_plants')
              .delete()
              .eq('user_id', user.id)
              .eq('plant_id', plantId)
              .then(() => {});
          }
          return prev.filter(f => f.plantId !== plantId);
        }
        const newEntry: FavouritePlant = { plantId, order: prev.length, quantity: 0 };
        if (user) {
          supabase
            .from('favourite_plants')
            .insert({ user_id: user.id, plant_id: plantId, order: prev.length, quantity: 0 })
            .then(() => {});
        }
        return [...prev, newEntry];
      });
    },
    [user],
  );

  const setQuantity = useCallback(
    (plantId: string, quantity: number) => {
      setFavourites(prev =>
        prev.map(f => {
          if (f.plantId !== plantId) return f;
          const q = Math.max(0, quantity);
          if (user) {
            supabase
              .from('favourite_plants')
              .update({ quantity: q })
              .eq('user_id', user.id)
              .eq('plant_id', plantId)
              .then(() => {});
          }
          return { ...f, quantity: q };
        }),
      );
    },
    [user],
  );

  const getQuantity = useCallback(
    (plantId: string) => favourites.find(f => f.plantId === plantId)?.quantity ?? 0,
    [favourites],
  );

  const reorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      setFavourites(prev => {
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        const reordered = next.map((f, i) => ({ ...f, order: i }));
        if (user) {
          Promise.all(
            reordered.map(f =>
              supabase
                .from('favourite_plants')
                .update({ order: f.order })
                .eq('user_id', user.id)
                .eq('plant_id', f.plantId),
            ),
          ).then(() => {});
        }
        return reordered;
      });
    },
    [user],
  );

  const getFavouriteIds = useCallback(
    () => [...favourites].sort((a, b) => a.order - b.order).map(f => f.plantId),
    [favourites],
  );

  const getFavouritesWithQuantity = useCallback(
    () => [...favourites].sort((a, b) => a.order - b.order),
    [favourites],
  );

  return {
    favourites,
    isFavourite,
    toggleFavourite,
    reorder,
    getFavouriteIds,
    setQuantity,
    getQuantity,
    getFavouritesWithQuantity,
  };
}
