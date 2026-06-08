CREATE OR REPLACE FUNCTION public.is_project_owner(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects
    WHERE id = p_project_id
      AND owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID, allowed_roles TEXT[] DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE project_members.project_id = p_project_id
      AND user_id = auth.uid()
      AND (allowed_roles IS NULL OR role = ANY(allowed_roles))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_project(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.is_project_owner(p_project_id)
      OR public.is_project_member(p_project_id);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_project(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.is_project_owner(p_project_id)
      OR public.is_project_member(p_project_id, ARRAY['owner', 'member']);
$$;

DROP POLICY IF EXISTS "project_members_select" ON public.projects;
DROP POLICY IF EXISTS "project_insert" ON public.projects;
DROP POLICY IF EXISTS "project_update" ON public.projects;
DROP POLICY IF EXISTS "project_members_all" ON public.project_members;
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
DROP POLICY IF EXISTS "tags_all" ON public.tags;
DROP POLICY IF EXISTS "task_tags_all" ON public.task_tags;
DROP POLICY IF EXISTS "task_comments_all" ON public.task_comments;

CREATE POLICY "projects_select" ON public.projects
  FOR SELECT USING (public.can_access_project(id));

CREATE POLICY "projects_insert" ON public.projects
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "projects_update" ON public.projects
  FOR UPDATE USING (public.is_project_owner(id))
  WITH CHECK (public.is_project_owner(id));

CREATE POLICY "project_members_select" ON public.project_members
  FOR SELECT USING (public.can_access_project(project_id));

CREATE POLICY "project_members_insert" ON public.project_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR public.is_project_owner(project_id)
  );

CREATE POLICY "project_members_update" ON public.project_members
  FOR UPDATE USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY "project_members_delete" ON public.project_members
  FOR DELETE USING (public.is_project_owner(project_id));

CREATE POLICY "tasks_select" ON public.tasks
  FOR SELECT USING (public.can_access_project(project_id));

CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT WITH CHECK (public.can_manage_project(project_id));

CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE USING (public.can_manage_project(project_id))
  WITH CHECK (public.can_manage_project(project_id));

CREATE POLICY "tags_all" ON public.tags
  FOR ALL USING (public.can_access_project(project_id))
  WITH CHECK (public.can_manage_project(project_id));

CREATE POLICY "task_tags_all" ON public.task_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_tags.task_id
        AND public.can_access_project(tasks.project_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_tags.task_id
        AND public.can_manage_project(tasks.project_id)
    )
  );

CREATE POLICY "task_comments_all" ON public.task_comments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_comments.task_id
        AND public.can_access_project(tasks.project_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_comments.task_id
        AND public.can_manage_project(tasks.project_id)
    )
  );

GRANT EXECUTE ON FUNCTION public.is_project_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_project_member(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_project(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_project(UUID) TO authenticated;
