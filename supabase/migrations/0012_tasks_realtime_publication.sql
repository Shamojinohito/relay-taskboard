-- Ensure tasks is in the realtime publication so postgres_changes
-- subscriptions (board + inbox) actually receive events.
-- Idempotent: no-op if the table was already added via the dashboard.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;
end $$;
