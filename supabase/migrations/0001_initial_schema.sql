-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Agents table (AI agents, separate from human users)
CREATE TABLE agents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('planner','tech_lead','worker','custom')),
  api_key     TEXT NOT NULL UNIQUE,  -- hashed with SHA-256
  project_ids UUID[] DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  owner_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  archived_at  TIMESTAMPTZ
);

-- Project members (human users)
CREATE TABLE project_members (
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('owner','member','viewer')),
  PRIMARY KEY (project_id, user_id)
);

-- Tags (project-scoped)
CREATE TABLE tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks (3-level: project > task > subtask)
CREATE TABLE tasks (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_task_id       UUID REFERENCES tasks(id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  description          TEXT,
  status               TEXT NOT NULL DEFAULT 'backlog'
                         CHECK (status IN ('backlog','todo','in_progress','in_review','done')),
  priority             TEXT NOT NULL DEFAULT 'medium'
                         CHECK (priority IN ('low','medium','high','urgent')),
  assignee_user_id     UUID REFERENCES auth.users(id),
  assignee_agent_id    UUID REFERENCES agents(id),
  created_by_user_id   UUID REFERENCES auth.users(id),
  created_by_agent_id  UUID REFERENCES agents(id),
  due_date             DATE,
  position             INTEGER DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_assignee CHECK (
    (assignee_user_id IS NULL OR assignee_agent_id IS NULL)
  )
);

-- Task-Tag many-to-many
CREATE TABLE task_tags (
  task_id  UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id   UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

-- Task comments (also stores AI agent instructions)
CREATE TABLE task_comments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id           UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  body              TEXT NOT NULL,
  author_user_id    UUID REFERENCES auth.users(id),
  author_agent_id   UUID REFERENCES agents(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Agent execution log
CREATE TABLE agent_runs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    UUID NOT NULL REFERENCES agents(id),
  trigger     TEXT NOT NULL CHECK (trigger IN ('manual','scheduled')),
  status      TEXT NOT NULL DEFAULT 'running'
                CHECK (status IN ('running','completed','failed')),
  summary     TEXT,
  started_at  TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_assignee_user ON tasks(assignee_user_id);
CREATE INDEX idx_tasks_assignee_agent ON tasks(assignee_agent_id);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX idx_project_members_user_id ON project_members(user_id);

-- Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "project_members_select" ON projects
  FOR SELECT USING (
    owner_id = auth.uid() OR
    id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

CREATE POLICY "project_insert" ON projects
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "project_update" ON projects
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "project_members_all" ON project_members
  FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()) OR
    user_id = auth.uid()
  );

CREATE POLICY "tasks_select" ON tasks
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "tasks_insert" ON tasks
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner','member')
    )
  );

CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE USING (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner','member')
    )
  );

CREATE POLICY "tags_all" ON tags
  FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "task_tags_all" ON task_tags
  FOR ALL USING (
    task_id IN (SELECT id FROM tasks)
  );

CREATE POLICY "task_comments_all" ON task_comments
  FOR ALL USING (
    task_id IN (SELECT id FROM tasks)
  );

-- Agents visible to all authenticated users
CREATE POLICY "agents_select" ON agents
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "agent_runs_select" ON agent_runs
  FOR SELECT USING (auth.role() = 'authenticated');
