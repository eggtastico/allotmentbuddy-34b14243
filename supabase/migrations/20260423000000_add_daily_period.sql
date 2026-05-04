-- Allow 'daily' as a valid task period
ALTER TABLE public.garden_tasks
  DROP CONSTRAINT IF EXISTS garden_tasks_period_check;

ALTER TABLE public.garden_tasks
  ADD CONSTRAINT garden_tasks_period_check
  CHECK (period IN ('daily', 'weekly', 'monthly'));
