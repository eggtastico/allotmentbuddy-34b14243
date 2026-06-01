import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { PlacedPlant, PlacedStructure, PlotSettings } from '@/types/garden';
import { GardenPlansResponseSchema, type GardenPlanRow } from '@/lib/schemas';
import type { Json } from '@/integrations/supabase/types';
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
      id?: string; name: string; settings: PlotSettings; plants: PlacedPlant[]; beds: PlacedStructure[];
    }) => {
      if (!user) throw new Error('Not logged in');
      const now = new Date().toISOString();
      // Strip photos from plants before sending to Supabase — photos are large
      // base64 blobs that live in IndexedDB only; storing them in JSONB causes JSON errors
      const plantsForCloud = plants.map(({ photos: _photos, ...rest }) => rest);
      const payload = {
        user_id: user.id,
        name,
        plot_settings: settings as unknown as Json,
        plants: plantsForCloud as unknown as Json,
        beds: beds as unknown as Json,
        updated_at: now,
      };
      if (id) {
        // Try to update existing plan first; if no rows matched it must be new, so insert.
        const { data: updated, error: updateError } = await supabase
          .from('garden_plans').update(payload).eq('id', id).select('updated_at');
        if (updateError) throw updateError;
        if (updated && updated.length > 0) {
          return { id, updated_at: updated[0].updated_at ?? now };
        }
        // Row did not exist yet — insert with the client-supplied id so local and
        // cloud storage always share the same plan UUID.
        const { data: inserted, error: insertError } = await supabase
          .from('garden_plans').insert({ id, ...payload }).select('id, updated_at').single();
        if (insertError) throw insertError;
        return { id: (inserted as { id: string; updated_at: string }).id, updated_at: (inserted as { id: string; updated_at: string }).updated_at };
      } else {
        const { data, error } = await supabase.from('garden_plans').insert(payload).select('id, updated_at').single();
        if (error) throw error;
        return { id: (data as { id: string; updated_at: string }).id, updated_at: (data as { id: string; updated_at: string }).updated_at };
      }
    },
    onSuccess: (_result, _variables) => {
      // Targeted invalidation — only refetch this user's plans
      queryClient.invalidateQueries({ queryKey: ['garden-plans', user?.id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('garden_plans').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onMutate: async (id: string) => {
      // Optimistic delete — remove from cache immediately
      await queryClient.cancelQueries({ queryKey: ['garden-plans', user?.id] });
      const previous = queryClient.getQueryData<GardenPlanRow[]>(['garden-plans', user?.id]);
      queryClient.setQueryData<GardenPlanRow[]>(
        ['garden-plans', user?.id],
        (old) => old?.filter(p => p.id !== id) ?? []
      );
      return { previous };
    },
    onError: (err: Error, _id, context) => {
      // Rollback on failure
      if (context?.previous) {
        queryClient.setQueryData(['garden-plans', user?.id], context.previous);
      }
      toast.error(err.message);
    },
    onSuccess: () => {
      toast.success('Plan deleted');
    },
  });

  return { plans, isLoading, save: saveMutation.mutateAsync, delete: deleteMutation.mutateAsync, isSaving: saveMutation.isPending };
}
