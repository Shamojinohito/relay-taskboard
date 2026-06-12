# Relay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AIエージェントと人間が非同期で協働するタスク管理アプリを構築する。プロジェクト→タスク→サブタスクの3階層管理、カンバンボード、My Tasks、エージェント管理、AIエージェントAPI連携を含む。

**Architecture:** Next.js 14 App Router + Supabase (PostgreSQL + Auth + Realtime)。ダークテーマUI (shadcn/ui + Tailwind)。エージェントはSupabase APIキーで認証し、Next.js API Routesを経由してタスクを操作。UIはSupabase Realtimeで即時更新。

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Supabase (Auth/DB/Realtime), @dnd-kit/core (drag & drop), React Query (@tanstack/react-query)

---

## File Structure

```
relay-taskboard/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                    # Sidebar + TopBar shell
│   │   ├── my-tasks/page.tsx
│   │   ├── projects/
│   │   │   └── [id]/
│   │   │       ├── page.tsx              # Kanban board
│   │   │       └── list/page.tsx         # Table list view
│   │   └── agents/page.tsx
│   ├── api/
│   │   └── agent/
│   │       ├── auth/route.ts
│   │       ├── tasks/route.ts
│   │       ├── tasks/[id]/route.ts
│   │       └── run/route.ts
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   └── topbar.tsx
│   ├── board/
│   │   ├── kanban-board.tsx
│   │   ├── kanban-column.tsx
│   │   └── task-card.tsx
│   ├── tasks/
│   │   ├── task-detail-panel.tsx
│   │   ├── task-form.tsx
│   │   ├── subtask-list.tsx
│   │   └── comment-list.tsx
│   ├── projects/
│   │   ├── project-list-view.tsx
│   │   └── create-project-dialog.tsx
│   └── agents/
│       ├── agent-list.tsx
│       └── agent-run-log.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts                     # browser client
│   │   ├── server.ts                     # server client (cookies)
│   │   └── types.ts                      # generated DB types
│   └── agents/
│       └── auth.ts                       # agent API key validation
├── hooks/
│   ├── use-projects.ts
│   ├── use-tasks.ts
│   └── use-realtime.ts
├── supabase/
│   ├── migrations/
│   │   └── 0001_initial_schema.sql
│   └── functions/
│       └── scheduled-agent-run/
│           └── index.ts
└── middleware.ts
```

---

## Phase 1: Project Setup

### Task 1: Next.js プロジェクト初期化

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`
- Create: `app/globals.css`
- Create: `app/layout.tsx`

- [ ] **Step 1: Next.jsプロジェクトを作成**

```bash
cd /Users/kohei_suzuki/Project
npx create-next-app@latest relay-taskboard \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*"
cd relay-taskboard
```

- [ ] **Step 2: 依存パッケージをインストール**

```bash
npm install @supabase/supabase-js @supabase/ssr \
  @tanstack/react-query \
  @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities \
  lucide-react \
  date-fns \
  clsx tailwind-merge

npx shadcn@latest init
```

shadcn init の設定:
- Style: Default
- Base color: Slate
- CSS variables: Yes

- [ ] **Step 3: shadcn/ui コンポーネントを追加**

```bash
npx shadcn@latest add button input label textarea badge
npx shadcn@latest add dialog sheet dropdown-menu
npx shadcn@latest add avatar separator scroll-area
npx shadcn@latest add select command popover
npx shadcn@latest add tooltip tabs
```

- [ ] **Step 4: ダークテーマのカラー変数を設定**

`app/globals.css` の `:root` と `.dark` セクションを以下に置き換える:

```css
@layer base {
  :root {
    --background: 216 28% 7%;
    --foreground: 213 31% 91%;
    --card: 215 25% 10%;
    --card-foreground: 213 31% 91%;
    --popover: 215 25% 10%;
    --popover-foreground: 213 31% 91%;
    --primary: 212 100% 67%;
    --primary-foreground: 222 47% 11%;
    --secondary: 215 20% 15%;
    --secondary-foreground: 213 31% 91%;
    --muted: 215 20% 15%;
    --muted-foreground: 217 10% 55%;
    --accent: 215 20% 15%;
    --accent-foreground: 213 31% 91%;
    --destructive: 0 63% 31%;
    --destructive-foreground: 213 31% 91%;
    --border: 217 19% 18%;
    --input: 217 19% 18%;
    --ring: 212 100% 67%;
    --radius: 0.5rem;
  }
}

* {
  @apply border-border;
}
body {
  @apply bg-background text-foreground;
}
```

- [ ] **Step 5: next.config.ts を設定**

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: '*.supabase.co' },
      { hostname: 'avatars.githubusercontent.com' },
      { hostname: 'lh3.googleusercontent.com' },
    ],
  },
}

export default nextConfig
```

- [ ] **Step 6: ルートlayoutをダークモード固定に設定**

```typescript
// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Relay',
  description: 'AI-Human collaborative task management',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 7: 動作確認**

```bash
npm run dev
```

`http://localhost:3000` で黒背景のページが表示されることを確認。

- [ ] **Step 8: コミット**

```bash
git add -A
git commit -m "feat: initialize Next.js project with shadcn/ui dark theme"
```

---

### Task 2: Supabase プロジェクトセットアップ

**Files:**
- Create: `.env.local`
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Supabaseプロジェクトを作成**

1. https://supabase.com にアクセスしてログイン
2. 「New project」でプロジェクト作成
3. Project name: `relay-taskboard`
4. Database Password: 強力なパスワードを設定・保存
5. Region: Northeast Asia (Tokyo)

- [ ] **Step 2: 環境変数を設定**

Supabase ダッシュボード → Settings → API から値を取得:

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
AGENT_API_SECRET=your-random-secret-for-agent-token-signing
```

`AGENT_API_SECRET` は `openssl rand -hex 32` で生成。

- [ ] **Step 3: Supabase ブラウザクライアントを作成**

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 4: Supabase サーバークライアントを作成**

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 5: middlewareを設定**

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // /api/agent/* はエージェント専用のため認証スキップ
  if (request.nextUrl.pathname.startsWith('/api/agent')) {
    return supabaseResponse
  }

  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 6: 一時的なDBタイプファイルを作成（後でSupabase CLIで生成）**

```typescript
// lib/supabase/types.ts
export type Database = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
```

- [ ] **Step 7: コミット**

```bash
git add -A
git commit -m "feat: add Supabase client setup and middleware auth guard"
```

---

## Phase 2: データベーススキーマ

### Task 3: Supabase マイグレーション作成・適用

**Files:**
- Create: `supabase/migrations/0001_initial_schema.sql`

- [ ] **Step 1: Supabase CLI をインストール**

```bash
npm install -g supabase
supabase login
supabase init
supabase link --project-ref <your-project-ref>
```

`<your-project-ref>` は Supabase ダッシュボードのURLの `https://supabase.com/dashboard/project/<ref>` の部分。

- [ ] **Step 2: マイグレーションファイルを作成**

```bash
supabase migration new initial_schema
```

`supabase/migrations/YYYYMMDDHHMMSS_initial_schema.sql` が生成される。

- [ ] **Step 3: スキーマSQLを記述**

生成されたファイルに以下を記述:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Agents table (AI agents, separate from human users)
CREATE TABLE agents (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('planner','tech_lead','worker','custom')),
  api_key     TEXT NOT NULL UNIQUE,  -- hashed with SHA-256
  project_ids UUID[] DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks (3-level: project > task > subtask)
CREATE TABLE tasks (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  position             INTEGER DEFAULT 0,  -- for ordering within column
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
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id           UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  body              TEXT NOT NULL,
  author_user_id    UUID REFERENCES auth.users(id),
  author_agent_id   UUID REFERENCES agents(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Agent execution log
CREATE TABLE agent_runs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- RLS Policies: users can access projects they are members of
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
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
        WHERE role IN ('owner','member')
    )
  );

CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE USING (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
        WHERE role IN ('owner','member')
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

-- Agents are visible to all authenticated users (read-only for non-owners)
CREATE POLICY "agents_select" ON agents
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "agent_runs_select" ON agent_runs
  FOR SELECT USING (auth.role() = 'authenticated');
```

- [ ] **Step 4: マイグレーションを適用**

```bash
supabase db push
```

Expected output: `Applying migration... Done.`

- [ ] **Step 5: Supabase Authの設定**

Supabase ダッシュボード → Authentication → Providers:
- Email: Enable
- GitHub: Enable (OAuth App を GitHub で作成し、Client ID/Secret を設定)

ダッシュボード → Authentication → URL Configuration:
- Site URL: `http://localhost:3000`
- Redirect URLs に追加: `http://localhost:3000/auth/callback`

- [ ] **Step 6: TypeScript型を生成**

```bash
supabase gen types typescript --linked > lib/supabase/types.ts
```

- [ ] **Step 7: コミット**

```bash
git add -A
git commit -m "feat: add database schema with RLS policies"
```

---

## Phase 3: 認証

### Task 4: ログインページとOAuth認証

**Files:**
- Create: `app/(auth)/login/page.tsx`
- Create: `app/auth/callback/route.ts`

- [ ] **Step 1: ログインページを作成**

```typescript
// app/(auth)/login/page.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const supabase = createClient()

  const signInWithGitHub = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  const signInWithEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMessage(error.message)
    setLoading(false)
  }

  const signUpWithEmail = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    })
    setMessage(error ? error.message : 'Check your email for the confirmation link.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 rounded-xl border border-border bg-card">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relay</h1>
          <p className="text-sm text-muted-foreground mt-1">AI-Human collaborative tasks</p>
        </div>

        <Button variant="outline" className="w-full" onClick={signInWithGitHub}>
          Continue with GitHub
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <form onSubmit={signInWithEmail} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email}
              onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password}
              onChange={e => setPassword(e.target.value)} required />
          </div>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={loading}>Sign In</Button>
            <Button type="button" variant="outline" className="flex-1"
              onClick={signUpWithEmail} disabled={loading}>Sign Up</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: OAuthコールバックルートを作成**

```typescript
// app/auth/callback/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}/my-tasks`)
}
```

- [ ] **Step 3: ログインページの動作確認**

```bash
npm run dev
```

`http://localhost:3000` にアクセスし、`/login` にリダイレクトされることを確認。

- [ ] **Step 4: コミット**

```bash
git add -A
git commit -m "feat: add login page with GitHub OAuth and email auth"
```

---

## Phase 4: レイアウト・ナビゲーション

### Task 5: ダッシュボードレイアウト（サイドバー + トップバー）

**Files:**
- Create: `app/(dashboard)/layout.tsx`
- Create: `components/layout/sidebar.tsx`
- Create: `components/layout/topbar.tsx`

- [ ] **Step 1: サイドバーコンポーネントを作成**

```typescript
// components/layout/sidebar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CheckSquare, FolderKanban, Bot, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useProjects } from '@/hooks/use-projects'
import CreateProjectDialog from '@/components/projects/create-project-dialog'
import { useState } from 'react'

export default function Sidebar() {
  const pathname = usePathname()
  const { projects } = useProjects()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <aside className="w-56 flex-shrink-0 border-r border-border bg-card flex flex-col h-screen">
      <div className="p-4 border-b border-border">
        <span className="text-lg font-bold text-primary">Relay</span>
      </div>

      <ScrollArea className="flex-1">
        <nav className="p-2 space-y-1">
          <Link href="/my-tasks">
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer",
              pathname === '/my-tasks'
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}>
              <CheckSquare size={16} />
              <span>My Tasks</span>
            </div>
          </Link>

          <div className="pt-3 pb-1 px-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Projects
              </span>
              <Button variant="ghost" size="icon" className="h-5 w-5"
                onClick={() => setCreateOpen(true)}>
                <Plus size={12} />
              </Button>
            </div>
          </div>

          {projects.map(project => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <div className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer truncate",
                pathname.startsWith(`/projects/${project.id}`)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}>
                <FolderKanban size={16} className="flex-shrink-0" />
                <span className="truncate">{project.name}</span>
              </div>
            </Link>
          ))}

          <div className="pt-3 pb-1 px-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Agents
            </span>
          </div>

          <Link href="/agents">
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer",
              pathname === '/agents'
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}>
              <Bot size={16} />
              <span>Agents</span>
            </div>
          </Link>
        </nav>
      </ScrollArea>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </aside>
  )
}
```

- [ ] **Step 2: トップバーコンポーネントを作成**

```typescript
// components/layout/topbar.tsx
'use client'

import { Bell, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'

export default function TopBar() {
  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '?'

  return (
    <header className="h-12 border-b border-border bg-card flex items-center justify-end px-4 gap-2">
      <Button variant="ghost" size="icon" className="h-8 w-8">
        <Bell size={16} />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 rounded-full p-0">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.user_metadata?.avatar_url} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={signOut}>
            <LogOut size={14} className="mr-2" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
```

- [ ] **Step 3: ダッシュボードレイアウトを作成**

```typescript
// app/(dashboard)/layout.tsx
import Sidebar from '@/components/layout/sidebar'
import TopBar from '@/components/layout/topbar'
import { QueryProvider } from '@/components/query-provider'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </QueryProvider>
  )
}
```

- [ ] **Step 4: React Query Providerを作成**

```typescript
// components/query-provider.tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 1000 * 60 } }
  }))
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
```

- [ ] **Step 5: useProjects フックを作成**

```typescript
// hooks/use-projects.ts
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export function useProjects() {
  const supabase = createClient()

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .is('archived_at', null)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
  })

  return { projects, isLoading }
}
```

- [ ] **Step 6: CreateProjectDialog を作成**

```typescript
// components/projects/create-project-dialog.tsx
'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function CreateProjectDialog({ open, onOpenChange }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()
  const supabase = createClient()

  const handleCreate = async () => {
    if (!name.trim()) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: project, error } = await supabase
      .from('projects')
      .insert({ name: name.trim(), description: description.trim() || null, owner_id: user.id })
      .select()
      .single()

    if (!error && project) {
      await supabase.from('project_members').insert({
        project_id: project.id, user_id: user.id, role: 'owner'
      })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setName('')
      setDescription('')
      onOpenChange(false)
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Project name" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Optional description" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={loading || !name.trim()}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 7: 動作確認**

```bash
npm run dev
```

ログイン後にサイドバー付きのダッシュボードレイアウトが表示されることを確認。

- [ ] **Step 8: コミット**

```bash
git add -A
git commit -m "feat: add dashboard layout with sidebar and topbar"
```

---

## Phase 5: カンバンボード

### Task 6: カンバンボードページ

**Files:**
- Create: `hooks/use-tasks.ts`
- Create: `components/board/kanban-board.tsx`
- Create: `components/board/kanban-column.tsx`
- Create: `components/board/task-card.tsx`
- Create: `app/(dashboard)/projects/[id]/page.tsx`

- [ ] **Step 1: useTasks フックを作成**

```typescript
// hooks/use-tasks.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done'

export function useTasks(projectId: string) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          task_tags(tag_id, tags(id, name, color)),
          assignee_user:assignee_user_id(id, email, raw_user_meta_data),
          assignee_agent:assignee_agent_id(id, name, type)
        `)
        .eq('project_id', projectId)
        .is('parent_task_id', null)
        .order('position', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })

  const updateStatus = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: TaskStatus }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', taskId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
  })

  return { tasks, isLoading, updateStatus }
}
```

- [ ] **Step 2: TaskCard コンポーネントを作成**

```typescript
// components/board/task-card.tsx
'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Bot, CalendarDays, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

const PRIORITY_COLORS = {
  low: 'text-blue-400',
  medium: 'text-yellow-400',
  high: 'text-orange-400',
  urgent: 'text-red-400',
} as const

interface TaskCardProps {
  task: {
    id: string
    title: string
    priority: string
    due_date: string | null
    task_tags: { tags: { id: string; name: string; color: string } | null }[]
    assignee_user: { email: string; raw_user_meta_data: Record<string, string> } | null
    assignee_agent: { name: string; type: string } | null
  }
  onClick: () => void
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-primary/50 transition-colors space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-foreground leading-snug">{task.title}</p>
        <AlertCircle size={14} className={cn('flex-shrink-0 mt-0.5', PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS])} />
      </div>

      {task.task_tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.task_tags.map(({ tags }) => tags && (
            <Badge key={tags.id} variant="outline" className="text-xs py-0 px-1.5"
              style={{ borderColor: tags.color, color: tags.color }}>
              {tags.name}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        {task.due_date && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays size={11} />
            {format(new Date(task.due_date), 'MMM d')}
          </div>
        )}
        <div className="ml-auto">
          {task.assignee_agent ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Bot size={12} />
              <span>{task.assignee_agent.name}</span>
            </div>
          ) : task.assignee_user ? (
            <Avatar className="h-6 w-6">
              <AvatarImage src={task.assignee_user.raw_user_meta_data?.avatar_url} />
              <AvatarFallback className="text-xs">
                {task.assignee_user.email.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : null}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: KanbanColumn コンポーネントを作成**

```typescript
// components/board/kanban-column.tsx
'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { TaskCard } from './task-card'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const COLUMN_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
}

interface KanbanColumnProps {
  status: string
  tasks: Parameters<typeof TaskCard>[0]['task'][]
  onTaskClick: (taskId: string) => void
  onAddTask: (status: string) => void
}

export function KanbanColumn({ status, tasks, onTaskClick, onAddTask }: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id: status })

  return (
    <div className="flex flex-col w-64 flex-shrink-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{COLUMN_LABELS[status]}</span>
          <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6"
          onClick={() => onAddTask(status)}>
          <Plus size={14} />
        </Button>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 min-h-24 rounded-lg p-2 transition-colors",
          isOver ? "bg-primary/5" : "bg-transparent"
        )}
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task.id)} />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: KanbanBoard コンポーネントを作成**

```typescript
// components/board/kanban-board.tsx
'use client'

import { useState } from 'react'
import {
  DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core'
import { KanbanColumn } from './kanban-column'
import { TaskCard } from './task-card'
import { useTasks, type TaskStatus } from '@/hooks/use-tasks'

const STATUSES: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'in_review', 'done']

interface KanbanBoardProps {
  projectId: string
  onTaskClick: (taskId: string) => void
  onAddTask: (status: string) => void
}

export function KanbanBoard({ projectId, onTaskClick, onAddTask }: KanbanBoardProps) {
  const { tasks, updateStatus } = useTasks(projectId)
  const [activeTask, setActiveTask] = useState<(typeof tasks)[0] | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 5 }
  }))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)
    if (!over || active.id === over.id) return

    const newStatus = STATUSES.find(s => s === over.id)
    if (newStatus) {
      updateStatus.mutate({ taskId: active.id as string, status: newStatus })
    }
  }

  const tasksByStatus = STATUSES.reduce((acc, status) => {
    acc[status] = tasks.filter(t => t.status === status)
    return acc
  }, {} as Record<TaskStatus, typeof tasks>)

  return (
    <DndContext sensors={sensors} onDragStart={e => {
      setActiveTask(tasks.find(t => t.id === e.active.id) ?? null)
    }} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 p-6 overflow-x-auto h-full">
        {STATUSES.map(status => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={tasksByStatus[status]}
            onTaskClick={onTaskClick}
            onAddTask={onAddTask}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask && (
          <TaskCard task={activeTask} onClick={() => {}} />
        )}
      </DragOverlay>
    </DndContext>
  )
}
```

- [ ] **Step 5: Project Board ページを作成**

```typescript
// app/(dashboard)/projects/[id]/page.tsx
'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { KanbanBoard } from '@/components/board/kanban-board'
import TaskDetailPanel from '@/components/tasks/task-detail-panel'
import TaskForm from '@/components/tasks/task-form'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useProjects } from '@/hooks/use-projects'
import Link from 'next/link'

export default function ProjectBoardPage() {
  const { id } = useParams<{ id: string }>()
  const { projects } = useProjects()
  const project = projects.find(p => p.id === id)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [createStatus, setCreateStatus] = useState<string | null>(null)

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">{project?.name ?? 'Loading...'}</h1>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="text-primary">Board</Button>
              <Link href={`/projects/${id}/list`}>
                <Button variant="ghost" size="sm" className="text-muted-foreground">List</Button>
              </Link>
            </div>
          </div>
          <Button size="sm" onClick={() => setCreateStatus('backlog')}>
            <Plus size={14} className="mr-1" /> Add Task
          </Button>
        </div>

        <KanbanBoard
          projectId={id}
          onTaskClick={setSelectedTaskId}
          onAddTask={setCreateStatus}
        />
      </div>

      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          projectId={id}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {createStatus && (
        <TaskForm
          projectId={id}
          initialStatus={createStatus}
          onClose={() => setCreateStatus(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 6: コミット**

```bash
git add -A
git commit -m "feat: add kanban board with drag-and-drop"
```

---

## Phase 6: タスク詳細・フォーム

### Task 7: タスク詳細パネルとタスク作成フォーム

**Files:**
- Create: `components/tasks/task-detail-panel.tsx`
- Create: `components/tasks/task-form.tsx`
- Create: `components/tasks/subtask-list.tsx`
- Create: `components/tasks/comment-list.tsx`

- [ ] **Step 1: TaskForm を作成**

```typescript
// components/tasks/task-form.tsx
'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'

interface TaskFormProps {
  projectId: string
  initialStatus: string
  parentTaskId?: string
  onClose: () => void
}

export default function TaskForm({ projectId, initialStatus, parentTaskId, onClose }: TaskFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium')
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()
  const supabase = createClient()

  const handleCreate = async () => {
    if (!title.trim()) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('tasks').insert({
      project_id: projectId,
      parent_task_id: parentTaskId ?? null,
      title: title.trim(),
      description: description.trim() || null,
      status: initialStatus as never,
      priority,
      due_date: dueDate || null,
      created_by_user_id: user?.id,
    })

    queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
    setLoading(false)
    onClose()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{parentTaskId ? 'Add Subtask' : 'Add Task'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={v => setPriority(v as typeof priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={loading || !title.trim()}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: CommentList を作成**

```typescript
// components/tasks/comment-list.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Bot } from 'lucide-react'
import { format } from 'date-fns'

interface Comment {
  id: string
  body: string
  created_at: string
  author_user_id: string | null
  author_agent_id: string | null
  author_agent: { name: string } | null
}

export default function CommentList({ taskId }: { taskId: string }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('task_comments')
      .select('*, author_agent:author_agent_id(name)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })
      .then(({ data }) => setComments((data ?? []) as Comment[]))

    const channel = supabase
      .channel(`comments:${taskId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'task_comments',
        filter: `task_id=eq.${taskId}`
      }, payload => {
        setComments(prev => [...prev, payload.new as Comment])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [taskId])

  const addComment = async () => {
    if (!body.trim()) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('task_comments').insert({
      task_id: taskId, body: body.trim(), author_user_id: user?.id
    })
    setBody('')
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {comments.map(c => (
          <div key={c.id} className="flex gap-2">
            {c.author_agent ? (
              <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Bot size={14} className="text-primary" />
              </div>
            ) : (
              <Avatar className="h-7 w-7 flex-shrink-0">
                <AvatarFallback className="text-xs">U</AvatarFallback>
              </Avatar>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-foreground">
                  {c.author_agent?.name ?? 'You'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(c.created_at), 'MMM d, HH:mm')}
                </span>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{c.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Textarea value={body} onChange={e => setBody(e.target.value)}
          placeholder="Add a comment or instruction..." rows={3} />
        <Button size="sm" onClick={addComment} disabled={loading || !body.trim()}>
          Comment
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: SubtaskList を作成**

```typescript
// components/tasks/subtask-list.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus } from 'lucide-react'

interface Subtask {
  id: string
  title: string
  status: string
}

interface SubtaskListProps {
  parentTaskId: string
  projectId: string
}

export default function SubtaskList({ parentTaskId, projectId }: SubtaskListProps) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [newTitle, setNewTitle] = useState('')
  const supabase = createClient()
  const queryClient = useQueryClient()

  useEffect(() => {
    supabase
      .from('tasks')
      .select('id, title, status')
      .eq('parent_task_id', parentTaskId)
      .order('created_at')
      .then(({ data }) => setSubtasks(data ?? []))
  }, [parentTaskId])

  const addSubtask = async () => {
    if (!newTitle.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('tasks').insert({
      project_id: projectId,
      parent_task_id: parentTaskId,
      title: newTitle.trim(),
      status: 'todo',
      priority: 'medium',
      created_by_user_id: user?.id,
    }).select('id, title, status').single()
    if (data) setSubtasks(prev => [...prev, data])
    setNewTitle('')
    queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
  }

  const toggleSubtask = async (subtask: Subtask) => {
    const newStatus = subtask.status === 'done' ? 'todo' : 'done'
    await supabase.from('tasks').update({ status: newStatus }).eq('id', subtask.id)
    setSubtasks(prev => prev.map(s => s.id === subtask.id ? { ...s, status: newStatus } : s))
  }

  return (
    <div className="space-y-2">
      {subtasks.map(sub => (
        <div key={sub.id} className="flex items-center gap-2">
          <Checkbox checked={sub.status === 'done'} onCheckedChange={() => toggleSubtask(sub)} />
          <span className={`text-sm ${sub.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {sub.title}
          </span>
        </div>
      ))}
      <div className="flex gap-2 mt-2">
        <Input value={newTitle} onChange={e => setNewTitle(e.target.value)}
          placeholder="Add subtask..." className="h-8 text-sm"
          onKeyDown={e => e.key === 'Enter' && addSubtask()} />
        <Button size="sm" variant="ghost" onClick={addSubtask} className="h-8">
          <Plus size={14} />
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: TaskDetailPanel を作成**

```typescript
// components/tasks/task-detail-panel.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import SubtaskList from './subtask-list'
import CommentList from './comment-list'

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  due_date: string | null
  task_tags: { tags: { id: string; name: string; color: string } | null }[]
}

interface TaskDetailPanelProps {
  taskId: string
  projectId: string
  onClose: () => void
}

export default function TaskDetailPanel({ taskId, projectId, onClose }: TaskDetailPanelProps) {
  const [task, setTask] = useState<Task | null>(null)
  const supabase = createClient()
  const queryClient = useQueryClient()

  useEffect(() => {
    supabase
      .from('tasks')
      .select('*, task_tags(tag_id, tags(id, name, color))')
      .eq('id', taskId)
      .single()
      .then(({ data }) => setTask(data as Task | null))
  }, [taskId])

  const updateTask = async (updates: Partial<Task>) => {
    await supabase.from('tasks').update(updates as never).eq('id', taskId)
    setTask(prev => prev ? { ...prev, ...updates } : prev)
    queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
  }

  if (!task) return null

  return (
    <div className="w-96 border-l border-border bg-card flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <Badge variant="outline">{task.status.replace('_', ' ')}</Badge>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X size={16} />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <Input
            value={task.title}
            onChange={e => setTask(prev => prev ? { ...prev, title: e.target.value } : prev)}
            onBlur={e => updateTask({ title: e.target.value })}
            className="text-base font-medium border-transparent bg-transparent px-0 focus-visible:ring-0"
          />

          <Textarea
            value={task.description ?? ''}
            onChange={e => setTask(prev => prev ? { ...prev, description: e.target.value } : prev)}
            onBlur={e => updateTask({ description: e.target.value || null })}
            placeholder="Add description..."
            className="border-transparent bg-transparent px-0 focus-visible:ring-0 text-sm text-muted-foreground resize-none"
            rows={3}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Status</span>
              <Select value={task.status} onValueChange={v => updateTask({ status: v as never })}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['backlog','todo','in_progress','in_review','done'].map(s => (
                    <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Priority</span>
              <Select value={task.priority} onValueChange={v => updateTask({ priority: v as never })}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['low','medium','high','urgent'].map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Due Date</span>
            <Input type="date" value={task.due_date ?? ''} className="h-8 text-sm"
              onChange={e => updateTask({ due_date: e.target.value || null })} />
          </div>

          {task.task_tags.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Tags</span>
              <div className="flex flex-wrap gap-1">
                {task.task_tags.map(({ tags }) => tags && (
                  <Badge key={tags.id} variant="outline" style={{ borderColor: tags.color, color: tags.color }}>
                    {tags.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Subtasks
            </span>
            <SubtaskList parentTaskId={taskId} projectId={projectId} />
          </div>

          <Separator />

          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Comments & Instructions
            </span>
            <CommentList taskId={taskId} />
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
```

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "feat: add task detail panel with subtasks and comments"
```

---

## Phase 7: My Tasks ページ

### Task 8: My Tasks ページ

**Files:**
- Create: `app/(dashboard)/my-tasks/page.tsx`

- [ ] **Step 1: My Tasks ページを作成**

```typescript
// app/(dashboard)/my-tasks/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TaskCard } from '@/components/board/task-card'
import TaskDetailPanel from '@/components/tasks/task-detail-panel'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

interface Task {
  id: string
  title: string
  priority: string
  due_date: string | null
  status: string
  project_id: string
  project: { name: string } | null
  task_tags: { tags: { id: string; name: string; color: string } | null }[]
  assignee_user: { email: string; raw_user_meta_data: Record<string, string> } | null
  assignee_agent: { name: string; type: string } | null
}

const STATUS_ORDER = ['todo', 'in_progress', 'in_review', 'backlog', 'done']

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const loadTasks = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('tasks')
        .select(`
          *,
          project:project_id(name),
          task_tags(tag_id, tags(id, name, color)),
          assignee_user:assignee_user_id(id, email, raw_user_meta_data),
          assignee_agent:assignee_agent_id(id, name, type)
        `)
        .eq('assignee_user_id', user.id)
        .neq('status', 'done')
        .order('due_date', { ascending: true, nullsFirst: false })

      setTasks((data ?? []) as Task[])
      setLoading(false)
    }
    loadTasks()
  }, [])

  const grouped = STATUS_ORDER.reduce((acc, status) => {
    const group = tasks.filter(t => t.status === status)
    if (group.length > 0) acc[status] = group
    return acc
  }, {} as Record<string, Task[]>)

  const selectedTask = tasks.find(t => t.id === selectedTaskId)

  const STATUS_LABELS: Record<string, string> = {
    todo: 'To Do',
    in_progress: 'In Progress',
    in_review: 'In Review',
    backlog: 'Backlog',
    done: 'Done',
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <h1 className="text-xl font-semibold mb-6">My Tasks</h1>

          {loading ? (
            <div className="text-muted-foreground text-sm">Loading...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p>No tasks assigned to you.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([status, groupTasks]) => (
                <div key={status}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-medium text-foreground">
                      {STATUS_LABELS[status]}
                    </span>
                    <Badge variant="secondary" className="text-xs">{groupTasks.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {groupTasks.map(task => (
                      <div key={task.id} className="relative">
                        <div className="absolute -left-3 top-3 text-xs text-muted-foreground
                          bg-secondary px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap">
                          {task.project?.name}
                        </div>
                        <div className="ml-2">
                          <TaskCard
                            task={task}
                            onClick={() => setSelectedTaskId(task.id)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedTaskId && selectedTask && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          projectId={selectedTask.project_id}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: コミット**

```bash
git add -A
git commit -m "feat: add My Tasks page grouped by status"
```

---

## Phase 8: エージェント管理ページ

### Task 9: Agents ページ

**Files:**
- Create: `app/(dashboard)/agents/page.tsx`
- Create: `components/agents/agent-list.tsx`
- Create: `components/agents/agent-run-log.tsx`

- [ ] **Step 1: AgentRunLog を作成**

```typescript
// components/agents/agent-run-log.tsx
'use client'

import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

interface AgentRun {
  id: string
  trigger: string
  status: string
  summary: string | null
  started_at: string
  finished_at: string | null
}

export function AgentRunLog({ runs }: { runs: AgentRun[] }) {
  const statusColor = (s: string) =>
    s === 'completed' ? 'text-green-400' : s === 'failed' ? 'text-red-400' : 'text-yellow-400'

  return (
    <div className="space-y-2">
      {runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No runs yet.</p>
      ) : runs.map(run => (
        <div key={run.id} className="flex items-start gap-3 text-sm border border-border rounded-lg p-3">
          <span className={`font-medium ${statusColor(run.status)} w-20 flex-shrink-0`}>
            {run.status}
          </span>
          <div className="flex-1 min-w-0">
            {run.summary && <p className="text-foreground truncate">{run.summary}</p>}
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(run.started_at), 'MM/dd HH:mm')}
              {' · '}
              <Badge variant="outline" className="text-xs py-0">{run.trigger}</Badge>
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: AgentList を作成**

```typescript
// components/agents/agent-list.tsx
'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Bot, Plus, Key, Copy } from 'lucide-react'

interface Agent {
  id: string
  name: string
  type: string
  created_at: string
}

const TYPE_COLORS: Record<string, string> = {
  planner: 'bg-purple-500/20 text-purple-300',
  tech_lead: 'bg-blue-500/20 text-blue-300',
  worker: 'bg-green-500/20 text-green-300',
  custom: 'bg-orange-500/20 text-orange-300',
}

export function AgentList({ agents }: { agents: Agent[] }) {
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<'planner' | 'tech_lead' | 'worker' | 'custom'>('worker')
  const [newApiKey, setNewApiKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const queryClient = useQueryClient()

  const createAgent = async () => {
    if (!name.trim()) return
    setLoading(true)
    const rawKey = `sk-agent-${crypto.randomUUID()}`

    // Hash the key before storing
    const encoder = new TextEncoder()
    const data = encoder.encode(rawKey)
    const hash = await crypto.subtle.digest('SHA-256', data)
    const hashedKey = Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0')).join('')

    await supabase.from('agents').insert({ name: name.trim(), type, api_key: hashedKey })
    setNewApiKey(rawKey)
    queryClient.invalidateQueries({ queryKey: ['agents'] })
    setLoading(false)
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold">Agents</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={14} className="mr-1" /> New Agent
        </Button>
      </div>

      <div className="space-y-2">
        {agents.map(agent => (
          <div key={agent.id} className="flex items-center gap-3 p-3 border border-border rounded-lg">
            <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center">
              <Bot size={16} className="text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{agent.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[agent.type]}`}>
                  {agent.type}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Created {new Date(agent.created_at).toLocaleDateString()}
              </p>
            </div>
            <Key size={14} className="text-muted-foreground" />
          </div>
        ))}
      </div>

      <Dialog open={createOpen} onOpenChange={v => { setCreateOpen(v); if (!v) { setNewApiKey(null); setName('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Agent</DialogTitle>
          </DialogHeader>

          {newApiKey ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Agent created. Copy this API key — it won't be shown again.
              </p>
              <div className="flex items-center gap-2 bg-secondary p-3 rounded-lg">
                <code className="text-xs flex-1 break-all">{newApiKey}</code>
                <Button size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0"
                  onClick={() => navigator.clipboard.writeText(newApiKey)}>
                  <Copy size={14} />
                </Button>
              </div>
              <Button className="w-full" onClick={() => { setCreateOpen(false); setNewApiKey(null); setName('') }}>
                Done
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. PlannerAgent" />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={v => setType(v as typeof type)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planner">Planner</SelectItem>
                      <SelectItem value="tech_lead">Tech Lead</SelectItem>
                      <SelectItem value="worker">Worker</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={createAgent} disabled={loading || !name.trim()}>Create</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 3: Agents ページを作成**

```typescript
// app/(dashboard)/agents/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AgentList } from '@/components/agents/agent-list'
import { AgentRunLog } from '@/components/agents/agent-run-log'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Play } from 'lucide-react'

export default function AgentsPage() {
  const [agents, setAgents] = useState<{id: string; name: string; type: string; created_at: string}[]>([])
  const [runs, setRuns] = useState<{id: string; trigger: string; status: string; summary: string | null; started_at: string; finished_at: string | null}[]>([])
  const supabase = createClient()

  useEffect(() => {
    supabase.from('agents').select('*').order('created_at').then(({ data }) => setAgents(data ?? []))
    supabase.from('agent_runs').select('*').order('started_at', { ascending: false }).limit(50)
      .then(({ data }) => setRuns(data ?? []))
  }, [])

  const triggerManualRun = async () => {
    await fetch('/api/agent/run', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
    supabase.from('agent_runs').select('*').order('started_at', { ascending: false }).limit(50)
      .then(({ data }) => setRuns(data ?? []))
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Agents</h1>
        <Button size="sm" onClick={triggerManualRun}>
          <Play size={14} className="mr-1" /> Run Now
        </Button>
      </div>

      <Tabs defaultValue="agents">
        <TabsList>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="runs">Run Log</TabsTrigger>
        </TabsList>
        <TabsContent value="agents" className="mt-4">
          <AgentList agents={agents} />
        </TabsContent>
        <TabsContent value="runs" className="mt-4">
          <AgentRunLog runs={runs} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 4: コミット**

```bash
git add -A
git commit -m "feat: add agents management page with run log"
```

---

## Phase 9: AI エージェント API

### Task 10: Agent API Routes

**Files:**
- Create: `lib/agents/auth.ts`
- Create: `app/api/agent/auth/route.ts`
- Create: `app/api/agent/tasks/route.ts`
- Create: `app/api/agent/tasks/[id]/route.ts`
- Create: `app/api/agent/run/route.ts`

- [ ] **Step 1: エージェント認証ヘルパーを作成**

```typescript
// lib/agents/auth.ts
import { createClient } from '@/lib/supabase/server'

export async function validateAgentApiKey(apiKey: string) {
  const encoder = new TextEncoder()
  const data = encoder.encode(apiKey)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const hashedKey = Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0')).join('')

  const supabase = await createClient()
  const { data: agent, error } = await supabase
    .from('agents')
    .select('*')
    .eq('api_key', hashedKey)
    .single()

  if (error || !agent) return null
  return agent
}
```

- [ ] **Step 2: Agent Auth ルートを作成**

```typescript
// app/api/agent/auth/route.ts
import { NextResponse } from 'next/server'
import { validateAgentApiKey } from '@/lib/agents/auth'
import { SignJWT } from 'jose'

export async function POST(request: Request) {
  const { api_key } = await request.json()
  if (!api_key) return NextResponse.json({ error: 'api_key required' }, { status: 400 })

  const agent = await validateAgentApiKey(api_key)
  if (!agent) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

  const secret = new TextEncoder().encode(process.env.AGENT_API_SECRET!)
  const token = await new SignJWT({ agentId: agent.id, agentName: agent.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(secret)

  return NextResponse.json({ token, agent: { id: agent.id, name: agent.name, type: agent.type } })
}
```

- [ ] **Step 3: jose パッケージをインストール**

```bash
npm install jose
```

- [ ] **Step 4: Agent タスク一覧ルートを作成**

```typescript
// app/api/agent/tasks/route.ts
import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { createClient } from '@/lib/supabase/server'

async function getAgentFromRequest(request: Request) {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  try {
    const secret = new TextEncoder().encode(process.env.AGENT_API_SECRET!)
    const { payload } = await jwtVerify(token, secret)
    return payload as { agentId: string; agentName: string }
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const agent = await getAgentFromRequest(request)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  const supabase = await createClient()
  let query = supabase
    .from('tasks')
    .select('*, task_comments(id, body, created_at, author_agent_id)')
    .eq('assignee_agent_id', agent.agentId)

  if (status) query = query.eq('status', status)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ tasks: data })
}
```

- [ ] **Step 5: Agent タスク更新ルートを作成**

```typescript
// app/api/agent/tasks/[id]/route.ts
import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { createClient } from '@/lib/supabase/server'

async function getAgentFromRequest(request: Request) {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  try {
    const secret = new TextEncoder().encode(process.env.AGENT_API_SECRET!)
    const { payload } = await jwtVerify(token, secret)
    return payload as { agentId: string; agentName: string }
  } catch {
    return null
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const agent = await getAgentFromRequest(request)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { comment, status, assignee_user_id, assignee_agent_id, priority } = body

  const supabase = await createClient()

  // Update task fields
  const updates: Record<string, unknown> = {}
  if (status) updates.status = status
  if (priority) updates.priority = priority
  if (assignee_user_id !== undefined) {
    updates.assignee_user_id = assignee_user_id
    updates.assignee_agent_id = null
  }
  if (assignee_agent_id !== undefined) {
    updates.assignee_agent_id = assignee_agent_id
    updates.assignee_user_id = null
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('tasks').update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Add comment if provided
  if (comment) {
    await supabase.from('task_comments').insert({
      task_id: id, body: comment, author_agent_id: agent.agentId
    })
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 6: Agent Run トリガールートを作成**

```typescript
// app/api/agent/run/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  // Get all agents
  const { data: agents } = await supabase.from('agents').select('id, name, type')
  if (!agents?.length) return NextResponse.json({ message: 'No agents configured' })

  // Log a manual run entry for each agent
  const runs = agents.map(agent => ({
    agent_id: agent.id,
    trigger: 'manual' as const,
    status: 'completed' as const,
    summary: `Manual run triggered. ${agent.name} should check assigned tasks.`,
  }))

  await supabase.from('agent_runs').insert(runs)

  return NextResponse.json({
    message: 'Agent run triggered',
    agentCount: agents.length,
    instruction: 'Agents should poll GET /api/agent/tasks to pick up assigned work.',
  })
}
```

- [ ] **Step 7: API動作確認**

```bash
# 1. エージェントを作成（UI上でAPIキーを取得）

# 2. 認証テスト
curl -X POST http://localhost:3000/api/agent/auth \
  -H "Content-Type: application/json" \
  -d '{"api_key": "sk-agent-<your-key>"}'
# Expected: { "token": "eyJ...", "agent": {...} }

# 3. タスク取得テスト
curl http://localhost:3000/api/agent/tasks \
  -H "Authorization: Bearer <token>"
# Expected: { "tasks": [...] }
```

- [ ] **Step 8: コミット**

```bash
git add -A
git commit -m "feat: add agent API routes for task management"
```

---

## Phase 10: Realtime & リスト表示

### Task 11: Realtime購読とプロジェクトリスト表示

**Files:**
- Create: `hooks/use-realtime.ts`
- Create: `app/(dashboard)/projects/[id]/list/page.tsx`

- [ ] **Step 1: useRealtime フックを作成**

```typescript
// hooks/use-realtime.ts
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export function useTasksRealtime(projectId: string) {
  const queryClient = useQueryClient()
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel(`tasks:${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `project_id=eq.${projectId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [projectId, queryClient])
}
```

- [ ] **Step 2: KanbanBoard に Realtime を組み込む**

`components/board/kanban-board.tsx` の `KanbanBoard` 関数内に追加:

```typescript
// components/board/kanban-board.tsx の KanbanBoard 関数の先頭に追加
import { useTasksRealtime } from '@/hooks/use-realtime'

export function KanbanBoard({ projectId, onTaskClick, onAddTask }: KanbanBoardProps) {
  useTasksRealtime(projectId)  // ← この行を追加
  const { tasks, updateStatus } = useTasks(projectId)
  // ... 残りは変更なし
```

- [ ] **Step 3: Project List ページを作成**

```typescript
// app/(dashboard)/projects/[id]/list/page.tsx
'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTasks } from '@/hooks/use-tasks'
import { useTasksRealtime } from '@/hooks/use-realtime'
import { useProjects } from '@/hooks/use-projects'
import TaskDetailPanel from '@/components/tasks/task-detail-panel'
import TaskForm from '@/components/tasks/task-form'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Plus, Bot, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

const PRIORITY_COLORS = {
  low: 'text-blue-400',
  medium: 'text-yellow-400',
  high: 'text-orange-400',
  urgent: 'text-red-400',
}

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
}

export default function ProjectListPage() {
  const { id } = useParams<{ id: string }>()
  const { projects } = useProjects()
  const project = projects.find(p => p.id === id)
  const { tasks } = useTasks(id)
  useTasksRealtime(id)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">{project?.name ?? 'Loading...'}</h1>
            <div className="flex gap-1">
              <Link href={`/projects/${id}`}>
                <Button variant="ghost" size="sm" className="text-muted-foreground">Board</Button>
              </Link>
              <Button variant="ghost" size="sm" className="text-primary">List</Button>
            </div>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} className="mr-1" /> Add Task
          </Button>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="text-left px-6 py-3 font-medium">Title</th>
              <th className="text-left px-4 py-3 font-medium w-28">Status</th>
              <th className="text-left px-4 py-3 font-medium w-24">Priority</th>
              <th className="text-left px-4 py-3 font-medium w-28">Assignee</th>
              <th className="text-left px-4 py-3 font-medium w-24">Due</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => (
              <tr key={task.id}
                className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors"
                onClick={() => setSelectedTaskId(task.id)}>
                <td className="px-6 py-3">
                  <span className="text-sm text-foreground">{task.title}</span>
                  {task.task_tags.map(({ tags }) => tags && (
                    <Badge key={tags.id} variant="outline" className="ml-2 text-xs py-0 px-1.5"
                      style={{ borderColor: tags.color, color: tags.color }}>
                      {tags.name}
                    </Badge>
                  ))}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-muted-foreground">
                    {STATUS_LABELS[task.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className={cn('flex items-center gap-1 text-xs', PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS])}>
                    <AlertCircle size={12} />
                    {task.priority}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {task.assignee_agent ? (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Bot size={12} />
                      <span>{task.assignee_agent.name}</span>
                    </div>
                  ) : task.assignee_user ? (
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={task.assignee_user.raw_user_meta_data?.avatar_url} />
                      <AvatarFallback className="text-xs">
                        {task.assignee_user.email.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {task.due_date ? format(new Date(task.due_date), 'MM/dd') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          projectId={id}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {createOpen && (
        <TaskForm
          projectId={id}
          initialStatus="backlog"
          onClose={() => setCreateOpen(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: コミット**

```bash
git add -A
git commit -m "feat: add realtime updates and project list view"
```

---

## Phase 11: スケジュール実行 (Supabase Edge Function)

### Task 12: Supabase Edge Function でのスケジュール実行

**Files:**
- Create: `supabase/functions/scheduled-agent-run/index.ts`

- [ ] **Step 1: Edge Functionを作成**

```typescript
// supabase/functions/scheduled-agent-run/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: agents } = await supabase.from('agents').select('id, name')

  if (agents?.length) {
    const runs = agents.map((agent: { id: string; name: string }) => ({
      agent_id: agent.id,
      trigger: 'scheduled',
      status: 'completed',
      summary: `Scheduled check triggered. ${agent.name} should poll assigned tasks.`,
    }))
    await supabase.from('agent_runs').insert(runs)
  }

  return new Response(JSON.stringify({ ok: true, agents: agents?.length ?? 0 }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

- [ ] **Step 2: Edge Functionをデプロイ**

```bash
supabase functions deploy scheduled-agent-run
```

- [ ] **Step 3: Supabase ダッシュボードでcronを設定**

Supabase ダッシュボード → Edge Functions → scheduled-agent-run → Schedule:
- Cron expression: `0 9 * * *` (毎朝9時 UTC)
- または任意のスケジュールに変更

- [ ] **Step 4: コミット**

```bash
git add -A
git commit -m "feat: add Supabase Edge Function for scheduled agent runs"
```

---

## Phase 12: 最終確認・微調整

### Task 13: ルートリダイレクトと仕上げ

**Files:**
- Modify: `app/page.tsx`
- Create: `app/(dashboard)/page.tsx`

- [ ] **Step 1: ルートをMy Tasksにリダイレクト**

```typescript
// app/page.tsx
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/my-tasks')
}
```

- [ ] **Step 2: ダッシュボードルートもリダイレクト**

```typescript
// app/(dashboard)/page.tsx
import { redirect } from 'next/navigation'

export default function DashboardPage() {
  redirect('/my-tasks')
}
```

- [ ] **Step 3: 全体動作確認**

```bash
npm run build
npm run start
```

以下の動作を確認:
1. 未ログイン状態で `/` にアクセス → `/login` にリダイレクト
2. ログイン後 → `/my-tasks` にリダイレクト
3. サイドバーからプロジェクト作成
4. カンバンボードでタスク作成・ドラッグ&ドロップ
5. タスク詳細パネルでサブタスク・コメント追加
6. My Tasks ページに自分宛てタスクが表示される
7. Agents ページでエージェント作成・APIキーコピー
8. API経由でタスク操作テスト（Task 10 Step 7）
9. 「Run Now」ボタンでRun Logに記録が残る

- [ ] **Step 4: 型チェック・ビルド確認**

```bash
npm run type-check 2>/dev/null || npx tsc --noEmit
```

エラーがあれば修正してから次へ。

- [ ] **Step 5: 最終コミット**

```bash
git add -A
git commit -m "feat: complete Relay initial implementation"
```

---

## まとめ

このプランの完了により以下が実現します:

| 機能 | 実装タスク |
|---|---|
| GitHub OAuth + メール認証 | Task 4 |
| サイドバー + ダッシュボードレイアウト | Task 5 |
| カンバンボード (ドラッグ&ドロップ) | Task 6 |
| タスク詳細パネル (サブタスク・コメント) | Task 7 |
| My Tasks ページ | Task 8 |
| Agents 管理ページ + APIキー発行 | Task 9 |
| AI エージェント REST API | Task 10 |
| Supabase Realtime リアルタイム更新 | Task 11 |
| プロジェクトリスト表示 | Task 11 |
| スケジュール実行 (cron) | Task 12 |
| ダークテーマUI | Task 1 |
