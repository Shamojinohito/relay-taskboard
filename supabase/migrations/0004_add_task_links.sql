CREATE TABLE IF NOT EXISTS public.task_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  title       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_links_task_id ON public.task_links(task_id);

ALTER TABLE public.task_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_links_all" ON public.task_links
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_links.task_id
        AND public.can_access_project(tasks.project_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_links.task_id
        AND public.can_manage_project(tasks.project_id)
    )
  );
