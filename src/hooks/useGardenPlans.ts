import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { PlacedPlant, GardenBed, PlotSettings, GardenPlan } from '@/types/garden';
import { GardenPlansResponseSchema, type GardenPlanRow } from '@/lib/schemas';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useGardenPlans() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['garden-plans', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('garden_plans')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(5);
      if (error) throw error;
      try {
        return GardenPlansResponseSchema.parse(data ?? []);
      } catch (parseError) {
        console.error('Failed to parse garden plans response', parseError);
        throw new Error('Invalid garden plans data from server');
      }
    },
    enabled: !!user,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, name, settings, plants, beds }: {
      id?: string; name: string; settings: PlotSettings; plants: PlacedPlant[]; beds: GardenBed[];
    }) => {
      if (!user) throw new Error('Not logged in');
      const now = new Date().toISOString();
      // Strip photos from plants before sending to Supabase — photos are large
      // base64 blobs that live in IndexedDB only; storing them in JSONB causes JSON errors
      const plantsForCloud = plants.map(({ photos: _photos, ...rest }) => rest);
      const payload = {
        user_id: user.id,
        name,
        plot_settings: settings,
        plants: plantsForCloud,
        beds,
        updated_at: now,
      };
      if (id) {
        const { data, error } = await supabase.from('garden_plans').update(payload).eq('id', id).select('updated_at').single();
        if (error) throw error;
        return { id, updated_at: data?.updated_at ?? now };
      } else {
        const { data, error } = await supabase.from('garden_plans').insert(payload).select('id, updated_at').single();
        if (error) throw error;
        return { id: (data as { id: string; updated_at: string }).id, updated_at: (data as { id: string; updated_at: string }).updated_at };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['garden-plans'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('garden_plans').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['garden-plans'] });
      toast.success('Plan deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { plans, isLoading, save: saveMutation.mutateAsync, delete: deleteMutation.mutateAsync, isSaving: saveMutation.isPending };
}
