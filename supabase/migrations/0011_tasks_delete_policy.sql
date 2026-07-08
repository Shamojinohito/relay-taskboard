-- tasks テーブルには SELECT/INSERT/UPDATE ポリシーしかなく（0003 で再作成した3本のみ）、
-- Web UI からの DELETE が RLS で常に 0 行マッチになっていた（エラーにならないため UI は成功扱い）。
-- 他テーブル（tags/task_tags/task_comments/task_links）は FOR ALL で DELETE 込みのため対象外。
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;
CREATE POLICY "tasks_delete" ON public.tasks
  FOR DELETE USING (public.can_manage_project(project_id));
