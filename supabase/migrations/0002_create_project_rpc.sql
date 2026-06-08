CREATE OR REPLACE FUNCTION public.create_project(
  project_name TEXT,
  project_description TEXT DEFAULT NULL
)
RETURNS public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_project public.projects;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF project_name IS NULL OR btrim(project_name) = '' THEN
    RAISE EXCEPTION 'Project name is required';
  END IF;

  INSERT INTO public.projects (name, description, owner_id)
  VALUES (btrim(project_name), NULLIF(btrim(project_description), ''), auth.uid())
  RETURNING * INTO new_project;

  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (new_project.id, auth.uid(), 'owner')
  ON CONFLICT (project_id, user_id) DO NOTHING;

  RETURN new_project;
END;
$$;

REVOKE ALL ON FUNCTION public.create_project(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_project(TEXT, TEXT) TO authenticated;
