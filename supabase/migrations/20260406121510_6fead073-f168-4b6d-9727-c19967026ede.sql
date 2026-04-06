-- Create journal_entries table
CREATE TABLE public.journal_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  notes TEXT DEFAULT '',
  photos TEXT[] DEFAULT '{}',
  garden_plan_id UUID REFERENCES public.garden_plans(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own journal entries"
  ON public.journal_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own journal entries"
  ON public.journal_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own journal entries"
  ON public.journal_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own journal entries"
  ON public.journal_entries FOR DELETE
  USING (auth.uid() = user_id);

-- Timestamp trigger
CREATE TRIGGER update_journal_entries_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for journal photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('journal-photos', 'journal-photos', true);

-- Storage policies
CREATE POLICY "Anyone can view journal photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'journal-photos');

CREATE POLICY "Authenticated users can upload journal photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'journal-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own journal photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'journal-photos' AND auth.uid()::text = (storage.foldername(name))[1]);