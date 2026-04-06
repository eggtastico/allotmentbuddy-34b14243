
CREATE TABLE public.garden_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  due_date DATE,
  period TEXT NOT NULL DEFAULT 'weekly' CHECK (period IN ('weekly', 'monthly')),
  completed BOOLEAN NOT NULL DEFAULT false,
  plant_name TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.garden_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tasks" ON public.garden_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own tasks" ON public.garden_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tasks" ON public.garden_tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own tasks" ON public.garden_tasks FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_garden_tasks_updated_at
  BEFORE UPDATE ON public.garden_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
