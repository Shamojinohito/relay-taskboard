CREATE INDEX IF NOT EXISTS idx_tasks_project_parent_position
  ON tasks(project_id, parent_task_id, position);

CREATE INDEX IF NOT EXISTS idx_tasks_assignee_user_status_due
  ON tasks(assignee_user_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_tasks_assignee_agent_status_priority
  ON tasks(assignee_agent_id, status, priority, due_date);
