# AirFlow TaskBoard — Design Spec
Date: 2026-06-07

## Overview

AIエージェントと人間が非同期で協働するタスク管理アプリ。エージェント同士が業務指示を明示的にアプリ内に記録し、必要に応じて人間に決裁を仰ぐ「非同期コミュニケーション掲示板」として機能する。

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript |
| UI | shadcn/ui + Tailwind CSS (dark theme) |
| State / Data | React Query + Supabase Realtime |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Edge Functions) |
| Agent API | Next.js API Routes (`/api/agent/*`) |
| Scheduling | Supabase Edge Functions (cron) |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Next.js App (Frontend)              │
│  ┌──────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │ Sidebar  │  │ Project     │  │  My Tasks      │  │
│  │ Nav      │  │ Board/List  │  │  Page          │  │
│  └──────────┘  └─────────────┘  └────────────────┘  │
│         ↕ Supabase Realtime (WebSocket)              │
├─────────────────────────────────────────────────────┤
│                  Supabase                            │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────┐   │
│  │ Auth     │  │ Postgres │  │ Realtime        │   │
│  │ (Human)  │  │ DB       │  │ Subscriptions   │   │
│  └──────────┘  └──────────┘  └─────────────────┘   │
├─────────────────────────────────────────────────────┤
│           Next.js API Routes (/api/*)                │
│  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │ /api/agent/run  │  │ /api/agent/webhook       │  │
│  │ (手動トリガー)   │  │ (スケジュール受信)         │  │
│  └─────────────────┘  └──────────────────────────┘  │
│                        ↑ Supabase Edge Functions cron│
└─────────────────────────────────────────────────────┘
```

AIエージェントはSupabase APIを直接呼び出してタスクを読み書きする。エージェントは `agents` テーブルのAPIキーで認証し、Row Level SecurityでアクセスできるプロジェクトをSupabase側で制限する。

## Data Model

```sql
-- Supabase Auth manages human users
-- users view: id, email, display_name, avatar_url

agents
  id          uuid PK
  name        text NOT NULL
  type        text CHECK (type IN ('planner','tech_lead','worker','custom'))
  api_key     text NOT NULL  -- hashed
  project_ids uuid[]
  created_at  timestamptz DEFAULT now()

projects
  id           uuid PK
  name         text NOT NULL
  description  text
  owner_id     uuid REFERENCES auth.users
  created_at   timestamptz DEFAULT now()
  archived_at  timestamptz

project_members
  project_id  uuid REFERENCES projects
  user_id     uuid REFERENCES auth.users
  role        text CHECK (role IN ('owner','member','viewer'))
  PRIMARY KEY (project_id, user_id)

tags
  id          uuid PK
  project_id  uuid REFERENCES projects
  name        text NOT NULL
  color       text NOT NULL  -- hex color code
  created_at  timestamptz DEFAULT now()

tasks
  id                   uuid PK
  project_id           uuid REFERENCES projects
  parent_task_id       uuid REFERENCES tasks  -- nullable: subtask
  title                text NOT NULL
  description          text
  status               text CHECK (status IN ('backlog','todo','in_progress','in_review','done'))
  priority             text CHECK (priority IN ('low','medium','high','urgent'))
  assignee_user_id     uuid REFERENCES auth.users  -- nullable
  assignee_agent_id    uuid REFERENCES agents       -- nullable (exclusive with user)
  created_by_user_id   uuid REFERENCES auth.users  -- nullable
  created_by_agent_id  uuid REFERENCES agents       -- nullable
  due_date             date
  created_at           timestamptz DEFAULT now()
  updated_at           timestamptz DEFAULT now()

task_tags
  task_id  uuid REFERENCES tasks
  tag_id   uuid REFERENCES tags
  PRIMARY KEY (task_id, tag_id)

task_comments  -- AIの業務指示もここに記録
  id                uuid PK
  task_id           uuid REFERENCES tasks
  body              text NOT NULL
  author_user_id    uuid REFERENCES auth.users  -- nullable
  author_agent_id   uuid REFERENCES agents       -- nullable
  created_at        timestamptz DEFAULT now()

agent_runs
  id          uuid PK
  agent_id    uuid REFERENCES agents
  trigger     text CHECK (trigger IN ('manual','scheduled'))
  status      text CHECK (status IN ('running','completed','failed'))
  summary     text
  started_at  timestamptz DEFAULT now()
  finished_at timestamptz
```

**設計ポイント：**
- `assignee_user_id` と `assignee_agent_id` は排他的（どちらか一方のみ）
- `task_comments` がエージェント間の業務指示の主な記録場所
- `parent_task_id` で3階層（プロジェクト→タスク→サブタスク）を実現
- タグはプロジェクトスコープで色付き管理

## UI Layout

```
┌─────────────────────────────────────────────────────────┐
│  [Logo] AirFlow          [通知] [ユーザーアバター]        │  ← トップバー
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│ My Tasks │   [プロジェクト名]          [+ タスク追加]    │
│          │   ┌──────────────────────────────────────┐  │
│ ─────    │   │ Board | List | Members | Settings    │  │
│          │   └──────────────────────────────────────┘  │
│ Projects │                                              │
│  ▸ Proj A│   ┌────────┐ ┌──────────┐ ┌────────────┐   │
│  ▸ Proj B│   │Backlog │ │In Progress│ │   Done     │   │
│  ▸ Proj C│   │[タスク]│ │[タスク]  │ │[タスク]    │   │
│          │   └────────┘ └──────────┘ └────────────┘   │
│ ─────    │                                              │
│ Agents   │                                              │
│  ▸ AI一覧│                                              │
└──────────┴──────────────────────────────────────────────┘
```

### Pages

| Page | Route | Description |
|---|---|---|
| My Tasks | `/my-tasks` | 自分にアサインされた全プロジェクトのタスクを集約。期日・優先度でソート可 |
| Project Board | `/projects/[id]` | カンバン表示。ドラッグ&ドロップでステータス変更 |
| Project List | `/projects/[id]/list` | テーブル形式。フィルタ・タグ・担当者で絞り込み |
| Task Detail | サイドパネル (overlay) | サブタスク・コメント・タグ・担当者を編集 |
| Agents | `/agents` | エージェント一覧・APIキー管理・実行ログ |

### Dark Theme Colors

| Token | Value | Usage |
|---|---|---|
| `background` | `#0d1117` | ページ背景 |
| `surface` | `#161b22` | カード・パネル |
| `border` | `#30363d` | 区切り線 |
| `accent` | `#58a6ff` | リンク・ボタン・フォーカス |
| `text-primary` | `#e6edf3` | 本文 |
| `text-muted` | `#8b949e` | サブテキスト |

## AI Agent Integration

### Authentication Flow

```
Agent → POST /api/agent/auth { api_key: "sk-..." }
      ← { token: "<supabase-jwt>" }
```

### Task Operations

```
# 自分にアサインされたタスク取得
GET /api/agent/tasks?status=todo

# ステータス更新 + コメント記録
PATCH /api/agent/tasks/:id
{ status: "in_progress", comment: "着手します" }

# 別エージェントへのアサイン
PATCH /api/agent/tasks/:id
{ assignee_agent_id: "tech-lead-id",
  comment: "実装をお願いします。要件: ..." }

# 人間への決裁依頼
PATCH /api/agent/tasks/:id
{ assignee_user_id: "user-uuid",
  priority: "urgent",
  comment: "承認が必要です。理由: ..." }
```

### Trigger Methods

| Method | Implementation |
|---|---|
| 手動 | UIボタン → `POST /api/agent/run` |
| スケジュール | Supabase Edge Functions cron → 同エンドポイント |

### Realtime Updates

エージェントがSupabaseを更新すると、UIがWebSocket経由で即座に再描画。人間はリアルタイムでエージェントの動きを確認できる。

## Security

- Row Level Security (RLS) でプロジェクトへのアクセスを制御
- エージェントのAPIキーはハッシュ化して保存
- `project_members` テーブルでプロジェクトごとの人間の権限を管理
- エージェントの `project_ids` で操作可能なプロジェクトを制限

## Directory Structure

```
airflow-taskboard/
├── app/
│   ├── (auth)/
│   │   └── login/
│   ├── (dashboard)/
│   │   ├── layout.tsx          # Sidebar + TopBar
│   │   ├── my-tasks/
│   │   ├── projects/
│   │   │   └── [id]/
│   │   │       ├── page.tsx    # Board view
│   │   │       └── list/
│   │   └── agents/
│   └── api/
│       └── agent/
│           ├── auth/
│           ├── tasks/
│           └── run/
├── components/
│   ├── board/                  # Kanban components
│   ├── tasks/                  # Task card, detail panel
│   ├── agents/                 # Agent list, run log
│   └── ui/                     # shadcn/ui wrappers
├── lib/
│   ├── supabase/               # client, server, types
│   └── agents/                 # agent auth helpers
└── supabase/
    ├── migrations/
    └── functions/              # Edge Functions (cron)
```
