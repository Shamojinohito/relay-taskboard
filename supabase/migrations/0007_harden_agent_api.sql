ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS scopes TEXT[] NOT NULL DEFAULT ARRAY[
    'read:tasks',
    'write:tasks',
    'write:comments',
    'claim:tasks',
    'run:dispatcher'
  ];

UPDATE agents
SET scopes = ARRAY[
  'read:tasks',
  'write:tasks',
  'write:comments',
  'claim:tasks',
  'run:dispatcher'
]
WHERE scopes IS NULL OR array_length(scopes, 1) IS NULL;

CREATE TABLE IF NOT EXISTS agent_audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID REFERENCES agents(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,
  task_id         UUID REFERENCES tasks(id) ON DELETE SET NULL,
  request_id      TEXT,
  idempotency_key TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_agent_id ON agent_audit_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_task_id ON agent_audit_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_created_at ON agent_audit_logs(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_audit_logs_idempotency
  ON agent_audit_logs(agent_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE agent_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_audit_logs_select" ON agent_audit_logs;
CREATE POLICY "agent_audit_logs_select" ON agent_audit_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE OR REPLACE FUNCTION claim_next_agent_task(p_agent_id UUID)
RETURNS SETOF tasks AS $$
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT t.id
    FROM tasks t
    WHERE t.assignee_agent_id = p_agent_id
      AND t.status IN ('backlog', 'todo')
      AND NOT EXISTS (
        SELECT 1
        FROM task_tags tt
        JOIN tags tg ON tg.id = tt.tag_id
        WHERE tt.task_id = t.id
          AND tg.name = 'dispatcher-lock'
      )
    ORDER BY
      CASE t.priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
        ELSE 5
      END,
      t.due_date ASC NULLS LAST,
      t.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE tasks t
  SET
    status = 'in_progress',
    blocked_reason = NULL
  FROM candidate
  WHERE t.id = candidate.id
  RETURNING t.*;
END;
$$ LANGUAGE plpgsql;
