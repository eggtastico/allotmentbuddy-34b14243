
-- Create seed_inventory table
CREATE TABLE public.seed_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plant_name TEXT NOT NULL,
  variety TEXT DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  purchased_date DATE,
  expiry_date DATE,
  seed_pack_photo_url TEXT,
  ai_extracted_data JSONB DEFAULT '{}'::jsonb,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.seed_inventory ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own seed inventory"
ON public.seed_inventory FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own seed inventory"
ON public.seed_inventory FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own seed inventory"
ON public.seed_inventory FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own seed inventory"
ON public.seed_inventory FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_seed_inventory_updated_at
BEFORE UPDATE ON public.seed_inventory
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for seed pack photos
INSERT INTO storage.buckets (id, name, public) VALUES ('seed-pack-photos', 'seed-pack-photos', true);

-- Storage policies
CREATE POLICY "Users can upload their own seed pack photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'seed-pack-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own seed pack photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'seed-pack-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own seed pack photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'seed-pack-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Seed pack photos are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'seed-pack-photos');
