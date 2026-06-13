# Sprint 1: Reliability — Design Spec

Date: 2026-06-13

## Goal

Make the core "human + AI agent share a board" experience trustworthy and complete:
the dispatcher should report what it actually did, run history should update live,
every major view should handle loading/empty/error states, and tasks should be
fully manageable (delete, no accidental empty titles).

## Scope (in)

1. Honest dispatcher run records (`triggered` status) + accurate summary text
2. Realtime updates for the Agent Run Log
3. Loading / empty / error states for: kanban board, list view, my tasks,
   agents page (agent list + run log), sidebar project list
4. Task delete (from detail panel) + title-empty-on-blur guard

## Scope (out)

- Real agent dispatch/execution logic (still out of scope — only the *reporting*
  of the trigger event becomes honest)
- Member management, assignee expansion, Cmd+K, filters, API versioning cleanup
  (Sprint 2/3 items)

## 1. Dispatcher honesty

### Migration: `0009_agent_run_triggered_status.sql`
Add `'triggered'` to the `agent_runs.status` CHECK constraint:
`('running','completed','failed','triggered')`.

### `app/api/agent/run/route.ts`
- Insert rows with `status: 'triggered'`, `trigger: 'manual'`, and
  `summary: 'Dispatcher issued instructions to {agent.name}.'`
- `finished_at` left null (run is not "finished", just triggered).
- Response message unchanged in shape but reflects the same wording.

### UI
- `agent-run-log.tsx`: add a badge/label mapping for `triggered` (e.g. neutral
  "Triggered" badge, distinct from green "Completed" / red "Failed" / blue
  "Running").

## 2. Run Log realtime + data layer

### New hook: `hooks/use-agent-runs.ts`
- `useAgentRuns()` — React Query (`queryKey: ['agent-runs']`), fetches latest 50
  `agent_runs` joined with agent name, ordered by `started_at desc`. Replaces the
  current manual `useEffect` fetch in `agent-run-log.tsx`.
- Exposes `{ runs, isLoading, error, refetch }`.

### New hook: `hooks/use-realtime.ts` addition
- `useAgentRunsRealtime()` — subscribes to `agent_runs` (INSERT + UPDATE, no
  filter — table is small/global), mirrors the existing `useTasksRealtime`
  pattern, updates the `['agent-runs']` query cache directly.

### `components/agents/agent-run-log.tsx`
- Switch to `useAgentRuns()` + `useAgentRunsRealtime()`.
- Add loading skeleton, error message + retry (refetch), keep existing
  "No runs yet." empty state.

## 3. Loading / Empty / Error states

### New primitive: `components/ui/skeleton.tsx`
Standard shadcn skeleton (`<div className="animate-pulse rounded-md bg-muted" />`).

### Per-view changes

- **Kanban board** (`kanban-board.tsx` / `kanban-column.tsx`):
  - While `isLoading`: render 3 columns × 3 skeleton cards instead of empty
    columns.
  - When loaded and **all** columns empty: show a centered "No tasks yet —
    Create your first task" CTA (button opens the existing create-task flow)
    overlaying/replacing the column row.
  - Error: replace the board area with a message + "Retry" button
    (`refetch` from `useTasks`).

- **List view** (`list/page.tsx`):
  - Loading: 5 skeleton rows.
  - Empty: single row spanning all columns with "No tasks yet" + create CTA.
  - Error: message + retry, same pattern as board.

- **My Tasks** (`my-tasks/page.tsx`):
  - Replace "Loading..." text with skeleton rows.
  - Keep existing empty copy, add a "Browse projects" link to `/` (sidebar
    project list) as CTA.
  - Add error message + retry if query errors (currently unhandled).

- **Agents page** (`agents/page.tsx`, `agent-list.tsx`):
  - Loading: skeleton cards for agent list.
  - Empty: "No agents yet" + hint pointing at the existing create-agent form
    on the same page.
  - Error + retry for the agents query.
  - Run log: covered in section 2.

- **Sidebar project list** (`sidebar.tsx`):
  - Loading: 3 skeleton rows.
  - Empty: "No projects yet" text (CTA already exists via "New project"
    button elsewhere in sidebar — just ensure it's visible in empty state).
  - Error: existing error text + small retry button.

All "retry" actions call the relevant React Query `refetch()`.

## 4. Task delete + title validation

### Delete
- `task-detail-panel.tsx`: add a "⋯" `DropdownMenu` next to the close button
  with a single "Delete task" item (destructive style).
- Selecting it opens a `Dialog` confirmation ("Delete task? This will also
  delete its subtasks, comments, and links. This cannot be undone." / Cancel /
  Delete).
- Confirm → `supabase.from('tasks').delete().eq('id', task.id)`. All child
  rows (subtasks via `parent_task_id`, `task_links`, `task_comments`,
  `task_tags`) cascade per existing FK constraints — verified in migrations
  0001/0004.
- On success: close the detail panel. The kanban board already removes the
  card via the existing realtime DELETE handler in `use-realtime.ts`; list
  view / my-tasks invalidate `['tasks', projectId]` / my-tasks query on
  success as a fallback for views without realtime.
- On error: show inline error message in the panel, do not close.

### Title validation
- `task-detail-panel.tsx` title field `onBlur`: if trimmed value is empty,
  reset the field to the last saved title (no save call). Non-empty values
  save as before.

## Testing

- Unit-testable logic: dispatcher run insertion (status/summary), title-blur
  guard logic (pure function if extractable), delete confirmation gating.
- New hooks (`use-agent-runs`, realtime additions) verified via existing
  patterns — no new test infra needed beyond what exists.
- UI states (skeletons/empty/error) verified manually via dev server: seed an
  empty project, simulate a fetch error (temporarily throw in queryFn), and
  confirm dispatcher run appears live without refresh.

## Open questions / assumptions

- Assumes `agent_runs` table is small enough that an unfiltered realtime
  subscription is acceptable (consistent with "Run Log" being a global, not
  per-project, view).
- Delete is a hard delete (no soft-delete/archive) — matches existing data
  model (no `deleted_at` column anywhere).
