import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
        .order('updated_at', { ascending: false });
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
      const payload = {
        user_id: user.id,
        name,
        plot_settings: settings,
        plants,
        beds,
      };
      if (id) {
        const { error } = await supabase.from('garden_plans').update(payload).eq('id', id);
        if (error) throw error;
        return { id };
      } else {
        const { data, error } = await supabase.from('garden_plans').insert(payload).select('id').single();
        if (error) throw error;
        return data as { id: string };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['garden-plans'] });
      toast.success('Garden saved! 🌿');
    },
    onError: (err: Error) => toast.error(err.message),
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
