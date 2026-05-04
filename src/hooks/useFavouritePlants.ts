import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { FavouritePlantsResponseSchema } from '@/lib/schemas';
import { z } from 'zod';
import { toast } from 'sonner';

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
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((f: unknown) => {
        if (typeof f !== 'object' || f === null) return null;
        const row = f as Record<string, unknown>;
        const plantId = (typeof row.plantId === 'string' ? row.plantId : undefined) ||
                       (typeof row.plant_id === 'string' ? row.plant_id : undefined);
        const order = typeof row.order === 'number' ? row.order : 0;
        const quantity = typeof row.quantity === 'number' ? row.quantity : 0;
        if (!plantId) return null;
        return { plantId, order, quantity };
      })
      .filter((f): f is FavouritePlant => f !== null);
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
              .then(({ error }) => {
                if (error) {
                  console.error('Failed to migrate favourite plants to Supabase:', error);
                }
              })
              .catch(err => console.error('Unexpected error migrating favourite plants:', err));
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
        const isFav = prev.some(f => f.plantId === plantId);

        if (isFav) {
          // Remove from favourites
          if (user) {
            supabase
              .from('favourite_plants')
              .delete()
              .eq('user_id', user.id)
              .eq('plant_id', plantId)
              .then(({ error }) => {
                if (error) {
                  console.error('Failed to remove favourite plant:', error);
                  toast.error('Failed to remove from favourites. Try again.');
                }
              })
              .catch(err => {
                console.error('Unexpected error removing favourite plant:', err);
                toast.error('Failed to remove from favourites. Try again.');
              });
          }
          return prev.filter(f => f.plantId !== plantId);
        }

        // Add to favourites
        const newEntry: FavouritePlant = { plantId, order: prev.length, quantity: 0 };
        if (user) {
          supabase
            .from('favourite_plants')
            .insert({ user_id: user.id, plant_id: plantId, order: prev.length, quantity: 0 })
            .then(({ error }) => {
              if (error) {
                console.error('Failed to add favourite plant:', error);
                toast.error('Failed to add to favourites. Try again.');
              }
            })
            .catch(err => {
              console.error('Unexpected error adding favourite plant:', err);
              toast.error('Failed to add to favourites. Try again.');
            });
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
              .then(({ error }) => {
                if (error) {
                  console.error('Failed to update favourite plant quantity:', error);
                  toast.error('Failed to update quantity. Try again.');
                }
              })
              .catch(err => {
                console.error('Unexpected error updating favourite plant quantity:', err);
                toast.error('Failed to update quantity. Try again.');
              });
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
                .eq('plant_id', f.plantId)
                .then(({ error }) => {
                  if (error) throw error;
                }),
            ),
          )
            .then(() => {
              // Success - order updated
            })
            .catch(err => {
              console.error('Failed to update favourite plants order:', err);
              toast.error('Failed to save order. Try again.');
            });
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
