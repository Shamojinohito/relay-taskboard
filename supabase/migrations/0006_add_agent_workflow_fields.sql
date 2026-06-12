ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS action_type TEXT NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS handoff_note TEXT,
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_status_changed_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_action_type_check;
ALTER TABLE tasks
  ADD CONSTRAINT tasks_action_type_check
  CHECK (action_type IN ('content','research','review','publish','setup','other'));

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('backlog','todo','in_progress','on_hold','blocked','in_review','done'));

UPDATE tasks
SET last_status_changed_at = COALESCE(updated_at, NOW())
WHERE last_status_changed_at IS NULL;

CREATE OR REPLACE FUNCTION update_task_status_changed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.last_status_changed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_status_changed_at ON tasks;
CREATE TRIGGER tasks_status_changed_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_task_status_changed_at();
