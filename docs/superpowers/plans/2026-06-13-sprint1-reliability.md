# Sprint 1 Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Relay dispatcher honest about what it does, make the Agent Run Log update live, give every major view proper loading/empty/error states, and let users delete tasks safely with title validation.

**Architecture:** Add a `triggered` status to `agent_runs` via migration; rewrite `/api/agent/run` to insert honest records. Introduce a `useAgentRuns` React Query hook + `useAgentRunsRealtime` subscription (mirroring the existing `useTasksRealtime` pattern) and refactor `agent-run-log.tsx`/`agents/page.tsx` to use them. Add a shared `Skeleton` primitive and apply loading/empty/error UI to the kanban board, list view, my-tasks, agents page, and sidebar. Add a delete action + confirmation dialog to the task detail panel, plus a title-blur guard against empty titles.

**Tech Stack:** Next.js 16 (App Router), React 19, Supabase (Postgres + Realtime), TanStack Query, shadcn/ui (base-ui), Tailwind, lucide-react, date-fns.

---

## Task 1: Migration — add `triggered` status to `agent_runs`

**Files:**
- Create: `supabase/migrations/0009_agent_run_triggered_status.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0009_agent_run_triggered_status.sql
ALTER TABLE agent_runs DROP CONSTRAINT IF EXISTS agent_runs_status_check;

ALTER TABLE agent_runs
  ADD CONSTRAINT agent_runs_status_check
  CHECK (status IN ('running','completed','failed','triggered'));
```

- [ ] **Step 2: Verify the migration applies cleanly**

Run: `cd supabase && supabase db lint` (if Supabase CLI is configured locally) — if the CLI
isn't available/linked, instead visually confirm the SQL matches the style of
`supabase/migrations/0006_add_agent_workflow_fields.sql` (same `ALTER TABLE ... DROP
CONSTRAINT IF EXISTS` / `ADD CONSTRAINT` pattern). No local DB push is required for this
plan — the migration file itself is the deliverable.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0009_agent_run_triggered_status.sql
git commit -m "feat: allow 'triggered' status for agent_runs"
```

---

## Task 2: Honest dispatcher run records in `/api/agent/run`

**Files:**
- Modify: `app/api/agent/run/route.ts`

- [ ] **Step 1: Replace the run-insertion logic**

Open `app/api/agent/run/route.ts`. Replace lines 35-42 (the `runs` map + insert) with:

```ts
  const runs = agents.map((agent: { id: string; name: string }) => ({
    agent_id: agent.id,
    trigger: 'manual',
    status: 'triggered',
    summary: `Dispatcher issued instructions to ${agent.name}.`,
  }))

  await (supabase.from('agent_runs') as any).insert(runs)
```

This is the only change needed in this file — the `status` value changes from
`'completed'` to `'triggered'` and the `summary` text changes from the old
"Manual dispatcher check triggered..." wording to the new per-agent wording.
Everything else in the file (the 72h stale-task block, the response JSON) stays as-is.

- [ ] **Step 2: Confirm the full file reads correctly**

Read `app/api/agent/run/route.ts` and confirm:
- Line ~38 reads `status: 'triggered'`
- Line ~39 reads `` summary: `Dispatcher issued instructions to ${agent.name}.`, ``
- The rest of the file (imports, `STALE_TASK_HOURS`, auth check, response) is unchanged.

- [ ] **Step 3: Commit**

```bash
git add app/api/agent/run/route.ts
git commit -m "fix: make dispatcher run records reflect actual triggered state"
```

---

## Task 3: `Skeleton` UI primitive

**Files:**
- Create: `components/ui/skeleton.tsx`

- [ ] **Step 1: Create the skeleton component**

```tsx
// components/ui/skeleton.tsx
import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
```

- [ ] **Step 2: Verify it builds**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new type errors related to `components/ui/skeleton.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/ui/skeleton.tsx
git commit -m "feat: add Skeleton UI primitive"
```

---

## Task 4: `useAgentRuns` + `useAgentRunsRealtime` hooks

**Files:**
- Create: `hooks/use-agent-runs.ts`
- Modify: `hooks/use-realtime.ts`

- [ ] **Step 1: Create the `useAgentRuns` query hook**

```ts
// hooks/use-agent-runs.ts
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface AgentRun {
  id: string
  agent_id: string
  trigger: string
  status: string
  summary: string | null
  started_at: string
  finished_at: string | null
}

export function useAgentRuns() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: runs = [], isLoading, error, refetch } = useQuery({
    queryKey: ['agent-runs'],
    queryFn: async (): Promise<AgentRun[]> => {
      const { data, error } = await supabase
        .from('agent_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data ?? []
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  return { runs, isLoading, error, refetch }
}
```

- [ ] **Step 2: Add `useAgentRunsRealtime` to `hooks/use-realtime.ts`**

Append this function to the end of `hooks/use-realtime.ts` (after
`useTasksRealtime`, keeping the same file):

```ts
export function useAgentRunsRealtime() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('agent-runs')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'agent_runs',
      }, (payload) => {
        const queryKey = ['agent-runs']

        if (payload.eventType === 'INSERT') {
          queryClient.setQueryData(queryKey, (current: unknown) => {
            if (!Array.isArray(current)) return current
            if (current.some((run: any) => run.id === payload.new.id)) return current
            return [payload.new, ...current].slice(0, 50)
          })
          return
        }

        if (payload.eventType === 'UPDATE') {
          queryClient.setQueryData(queryKey, (current: unknown) => {
            if (!Array.isArray(current)) return current
            return current.map((run: any) =>
              run.id === payload.new.id ? { ...run, ...payload.new } : run
            )
          })
          return
        }

        queryClient.invalidateQueries({ queryKey, refetchType: 'inactive' })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [queryClient])
}
```

- [ ] **Step 3: Verify the file compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new type errors from `hooks/use-realtime.ts` or `hooks/use-agent-runs.ts`.

- [ ] **Step 4: Commit**

```bash
git add hooks/use-agent-runs.ts hooks/use-realtime.ts
git commit -m "feat: add useAgentRuns query hook and realtime subscription"
```

---

## Task 5: Wire up Agent Run Log with loading/empty/error + realtime + `triggered` badge

**Files:**
- Modify: `components/agents/agent-run-log.tsx`
- Modify: `app/(dashboard)/agents/page.tsx`

- [ ] **Step 1: Rewrite `agent-run-log.tsx` to fetch its own data**

```tsx
// components/agents/agent-run-log.tsx
'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAgentRuns } from '@/hooks/use-agent-runs'
import { useAgentRunsRealtime } from '@/hooks/use-realtime'
import { format } from 'date-fns'

const STATUS_STYLES: Record<string, string> = {
  completed: 'text-green-400',
  failed: 'text-red-400',
  running: 'text-yellow-400',
  triggered: 'text-sky-400',
}

export function AgentRunLog() {
  const { runs, isLoading, error, refetch } = useAgentRuns()
  useAgentRunsRealtime()

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map(i => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        <p>Failed to load run log: {(error as Error).message}</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No runs yet.</p>
      ) : runs.map(run => (
        <div key={run.id} className="flex items-start gap-3 text-sm border border-border rounded-lg p-3">
          <span className={`font-medium ${STATUS_STYLES[run.status] ?? 'text-muted-foreground'} w-20 flex-shrink-0`}>
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

Note: the component no longer takes a `runs` prop — it fetches and subscribes itself.

- [ ] **Step 2: Update `agents/page.tsx` to drop the manual run-loading code**

In `app/(dashboard)/agents/page.tsx`:
1. Remove the `AgentRun` interface (lines 16-23), the `runs`/`setRuns` state (line 27),
   the `loadRuns` function (lines 30-36), and the `loadRuns()` call inside `useEffect`
   (line 43).
2. Change `<AgentRunLog runs={runs} />` (line 66) to `<AgentRunLog />`.

The resulting `useEffect` (around lines 38-44) should become:

```tsx
  useEffect(() => {
    ;(supabase.from('agents') as any)
      .select('*')
      .order('created_at')
      .then(({ data }: { data: Agent[] | null }) => setAgents(data ?? []))
  }, [])
```

And the `TabsContent` for runs becomes:

```tsx
        <TabsContent value="runs" className="mt-4">
          <AgentRunLog />
        </TabsContent>
```

- [ ] **Step 3: Verify it builds**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors in `agent-run-log.tsx` or `agents/page.tsx`.

- [ ] **Step 4: Commit**

```bash
git add components/agents/agent-run-log.tsx "app/(dashboard)/agents/page.tsx"
git commit -m "feat: realtime agent run log with loading/empty/error states"
```

---

## Task 6: Agents page — loading/empty/error for agent list

**Files:**
- Modify: `app/(dashboard)/agents/page.tsx`
- Modify: `components/agents/agent-list.tsx`

- [ ] **Step 1: Convert the agents fetch to React Query in `agents/page.tsx`**

Replace the `agents`/`setAgents` state and its `useEffect` with a `useQuery` call so
loading/error states are available. Replace:

```tsx
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
```

with:

```tsx
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
```

Replace the body from the `const [agents, setAgents]` line through the `useEffect`
block with:

```tsx
  const supabase = createClient()

  const { data: agents = [], isLoading, error, refetch } = useQuery({
    queryKey: ['agents'],
    queryFn: async (): Promise<Agent[]> => {
      const { data, error } = await (supabase.from('agents') as any)
        .select('*')
        .order('created_at')
      if (error) throw error
      return data ?? []
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
```

(Keep the `Agent` interface as-is. Remove the now-unused `AgentRun` interface if not
already removed in Task 5.)

- [ ] **Step 2: Pass loading/error/refetch into `AgentList`**

Change:

```tsx
        <TabsContent value="agents" className="mt-4">
          <AgentList agents={agents} />
        </TabsContent>
```

to:

```tsx
        <TabsContent value="agents" className="mt-4">
          <AgentList agents={agents} isLoading={isLoading} error={error as Error | null} onRetry={refetch} />
        </TabsContent>
```

- [ ] **Step 3: Update `AgentList` props and render loading/empty/error**

In `components/agents/agent-list.tsx`:

Add imports:

```tsx
import { Skeleton } from '@/components/ui/skeleton'
```

Change the function signature:

```tsx
export function AgentList({
  agents,
  isLoading,
  error,
  onRetry,
}: {
  agents: Agent[]
  isLoading?: boolean
  error?: Error | null
  onRetry?: () => void
}) {
```

Replace the `<div className="space-y-2">{agents.map(...)}</div>` block (lines 68-88)
with:

```tsx
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => (
            <Skeleton key={i} className="h-[60px] w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <p>Failed to load agents: {error.message}</p>
          {onRetry && (
            <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
              Retry
            </Button>
          )}
        </div>
      ) : agents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No agents yet. Use &ldquo;New Agent&rdquo; above to register one.
        </div>
      ) : (
        <div className="space-y-2">
          {agents.map(agent => (
            <div key={agent.id} className="flex items-center gap-3 p-3 border border-border rounded-lg">
              <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center">
                <Bot size={16} className="text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{agent.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[agent.type] ?? TYPE_COLORS.custom}`}>
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
      )}
```

(Note: this also fixes the `TYPE_COLORS[agent.type]` undefined-fallback issue by
falling back to `TYPE_COLORS.custom`.)

Also update `createAgent`'s `queryClient.invalidateQueries({ queryKey: ['agents'] })`
— this already matches the new query key, no change needed there.

- [ ] **Step 4: Verify it builds**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors in `agents/page.tsx` or `agent-list.tsx`.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/agents/page.tsx" components/agents/agent-list.tsx
git commit -m "feat: add loading/empty/error states to agents list"
```

---

## Task 7: Sidebar — loading/empty states for project list

**Files:**
- Modify: `components/layout/sidebar.tsx`

- [ ] **Step 1: Add `Skeleton` import and use `isLoading` from `useProjects`**

Add to imports:

```tsx
import { Skeleton } from '@/components/ui/skeleton'
```

Change:

```tsx
  const { projects, error } = useProjects()
```

to:

```tsx
  const { projects, isLoading, error } = useProjects()
```

- [ ] **Step 2: Render skeleton/empty/list states**

Replace:

```tsx
          {(projects as any[]).map(project => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className={cn(navItemClassName(pathname.startsWith(`/projects/${project.id}`)), "truncate")}
            >
              <FolderKanban size={15} className="flex-shrink-0" />
              <span className="truncate">{project.name}</span>
            </Link>
          ))}

          {error && (
            <p className="px-3 py-2 text-xs text-destructive">
              Failed to load projects
            </p>
          )}
```

with:

```tsx
          {isLoading ? (
            <div className="space-y-1 px-3">
              {[0, 1, 2].map(i => (
                <Skeleton key={i} className="h-8 w-full rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <p className="px-3 py-2 text-xs text-destructive">
              Failed to load projects
            </p>
          ) : (projects as any[]).length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No projects yet. Use the + above to create one.
            </p>
          ) : (
            (projects as any[]).map(project => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className={cn(navItemClassName(pathname.startsWith(`/projects/${project.id}`)), "truncate")}
              >
                <FolderKanban size={15} className="flex-shrink-0" />
                <span className="truncate">{project.name}</span>
              </Link>
            ))
          )}
```

- [ ] **Step 3: Verify it builds**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors in `sidebar.tsx`.

- [ ] **Step 4: Commit**

```bash
git add components/layout/sidebar.tsx
git commit -m "feat: add loading/empty states to sidebar project list"
```

---

## Task 8: Kanban board — loading/empty/error states

**Files:**
- Modify: `components/board/kanban-board.tsx`
- Modify: `components/board/kanban-column.tsx`

- [ ] **Step 1: Expose `isLoading` from `useTasks` usage and pass to columns**

In `components/board/kanban-board.tsx`, change:

```tsx
  const { tasks, error, updateStatus } = useTasks(projectId)
```

to:

```tsx
  const { tasks, isLoading, error, updateStatus } = useTasks(projectId)
```

- [ ] **Step 2: Render skeleton columns while loading, and an empty-board CTA**

Replace the return block's inner content. The current structure is:

```tsx
      <div className="flex h-full gap-5 overflow-x-auto bg-background px-6 py-5">
        {error && (
          <div className="w-80 flex-shrink-0 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load tasks: {(error as Error).message}
          </div>
        )}
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
```

Replace it with:

```tsx
      <div className="flex h-full gap-5 overflow-x-auto bg-background px-6 py-5">
        {error ? (
          <div className="flex w-full flex-col items-center justify-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-8 text-sm text-destructive">
            <p>Failed to load tasks: {(error as Error).message}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : isLoading ? (
          STATUSES.map(status => (
            <KanbanColumn key={status} status={status} tasks={[]} isLoading onTaskClick={onTaskClick} onAddTask={onAddTask} />
          ))
        ) : tasks.length === 0 ? (
          <div className="flex w-full flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
            <p className="text-sm">No tasks yet.</p>
            <Button size="sm" onClick={() => onAddTask('backlog')}>Create your first task</Button>
          </div>
        ) : (
          STATUSES.map(status => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={tasksByStatus[status]}
              onTaskClick={onTaskClick}
              onAddTask={onAddTask}
            />
          ))
        )}
      </div>
```

Add `refetch` to the destructured result of `useTasks` (Task 8 Step 1):

```tsx
  const { tasks, isLoading, error, updateStatus, refetch } = useTasks(projectId)
```

This requires `useTasks` to return `refetch` — update `hooks/use-tasks.ts`'s return
statement from:

```ts
  return { tasks, isLoading, error, updateStatus }
```

to:

```ts
  return { tasks, isLoading, error, updateStatus, refetch }
```

(`refetch` is already available from the `useQuery` result — destructure it alongside
`data`, `isLoading`, `error` in the `useQuery` call at the top of `useTasks`.)

Add the `Button` import to `kanban-board.tsx`:

```tsx
import { Button } from '@/components/ui/button'
```

- [ ] **Step 3: Add `isLoading` skeleton rendering to `KanbanColumn`**

In `components/board/kanban-column.tsx`, add imports:

```tsx
import { Skeleton } from '@/components/ui/skeleton'
```

Update the props interface:

```tsx
interface KanbanColumnProps {
  status: string
  tasks: Parameters<typeof TaskCard>[0]['task'][]
  isLoading?: boolean
  onTaskClick: (taskId: string) => void
  onAddTask: (status: string) => void
}
```

Update the function signature:

```tsx
export function KanbanColumn({ status, tasks, isLoading, onTaskClick, onAddTask }: KanbanColumnProps) {
```

Inside the droppable `<div>`, before the `<SortableContext>`, add a skeleton branch.
Replace:

```tsx
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 min-h-32 rounded-lg border border-transparent p-2 transition-colors",
          isOver ? "border-primary/35 bg-primary/8" : "bg-background/35"
        )}
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task.id)} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <button
            type="button"
            onClick={() => onAddTask(status)}
            className="flex h-20 w-full items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
          >
            Drop or add task
          </button>
        )}
      </div>
```

with:

```tsx
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 min-h-32 rounded-lg border border-transparent p-2 transition-colors",
          isOver ? "border-primary/35 bg-primary/8" : "bg-background/35"
        )}
      >
        {isLoading ? (
          <>
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </>
        ) : (
          <>
            <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {tasks.map(task => (
                <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task.id)} />
              ))}
            </SortableContext>
            {tasks.length === 0 && (
              <button
                type="button"
                onClick={() => onAddTask(status)}
                className="flex h-20 w-full items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
              >
                Drop or add task
              </button>
            )}
          </>
        )}
      </div>
```

- [ ] **Step 4: Verify it builds**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors in `kanban-board.tsx`, `kanban-column.tsx`, or `use-tasks.ts`.

- [ ] **Step 5: Commit**

```bash
git add components/board/kanban-board.tsx components/board/kanban-column.tsx hooks/use-tasks.ts
git commit -m "feat: add loading/empty/error states to kanban board"
```

---

## Task 9: List view — loading/empty/error states

**Files:**
- Modify: `app/(dashboard)/projects/[id]/list/page.tsx`

- [ ] **Step 1: Destructure `isLoading`, `error`, `refetch` from `useTasks`**

Change:

```tsx
  const { tasks } = useTasks(id)
```

to:

```tsx
  const { tasks, isLoading, error, refetch } = useTasks(id)
```

- [ ] **Step 2: Add `Skeleton` and `Button` imports**

```tsx
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
```

- [ ] **Step 3: Render loading/empty/error rows in `<tbody>`**

Replace:

```tsx
            <tbody>
              {sortedTasks.map((task: any) => (
```

...through the closing `</tbody>`, restructuring as follows. Keep the `<thead>` as-is.
Replace the entire `<tbody>...</tbody>` block with:

```tsx
            <tbody>
              {error ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-destructive">
                    <p>Failed to load tasks: {(error as Error).message}</p>
                    <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
                      Retry
                    </Button>
                  </td>
                </tr>
              ) : isLoading ? (
                [0, 1, 2, 3, 4].map(i => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="px-6 py-3" colSpan={5}>
                      <Skeleton className="h-5 w-full rounded" />
                    </td>
                  </tr>
                ))
              ) : sortedTasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-muted-foreground">
                    No tasks yet.
                  </td>
                </tr>
              ) : sortedTasks.map((task: any) => (
                <tr key={task.id}
                  className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors"
                  onClick={() => setSelectedTaskId(task.id)}>
                  <td className="px-6 py-3">
                    <span className="text-sm text-foreground">{task.title}</span>
                    {task.task_tags?.map(({ tags }: any) => tags && (
                      <Badge key={tags.id} variant="outline" className="ml-2 text-xs py-0 px-1.5"
                        style={{ borderColor: tags.color, color: tags.color }}>
                        {tags.name}
                      </Badge>
                    ))}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className={cn('size-2 rounded-full', getTaskStatusDotColor(task.status))} />
                      {getTaskStatusLabel(task.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className={cn('flex items-center gap-1 text-xs', PRIORITY_COLORS[task.priority] ?? '')}>
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
```

- [ ] **Step 4: Verify it builds**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors in `list/page.tsx`.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/projects/[id]/list/page.tsx"
git commit -m "feat: add loading/empty/error states to list view"
```

---

## Task 10: My Tasks — skeleton loading, error state, CTA in empty state

**Files:**
- Modify: `app/(dashboard)/my-tasks/page.tsx`

- [ ] **Step 1: Destructure `error` and `refetch` from the query**

Change:

```tsx
  const { data: tasks = [], isLoading: loading } = useQuery({
```

to:

```tsx
  const { data: tasks = [], isLoading: loading, error, refetch } = useQuery({
```

- [ ] **Step 2: Add `Skeleton` and `Link` imports**

```tsx
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
```

- [ ] **Step 3: Replace the loading/empty rendering**

Replace:

```tsx
          {loading ? (
            <div className="text-muted-foreground text-sm">Loading...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p>No tasks assigned to you.</p>
            </div>
          ) : (
```

with:

```tsx
          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              <p>Failed to load tasks: {(error as Error).message}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map(i => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p>No tasks assigned to you.</p>
              <Link href="/" className="mt-2 inline-block text-sm text-primary hover:underline">
                Browse projects
              </Link>
            </div>
          ) : (
```

- [ ] **Step 4: Verify it builds**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors in `my-tasks/page.tsx`.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/my-tasks/page.tsx"
git commit -m "feat: add skeleton loading, error state, and CTA to My Tasks"
```

---

## Task 11: Task delete (detail panel) + title-blur validation

**Files:**
- Modify: `components/tasks/task-detail-panel.tsx`

- [ ] **Step 1: Add imports**

Add to the top of `components/tasks/task-detail-panel.tsx`:

```tsx
import { MoreHorizontal, Trash2 } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
```

(`X` is already imported from `lucide-react` on line 7 — keep it, add `MoreHorizontal`
and `Trash2` alongside it.)

- [ ] **Step 2: Add delete state and handler**

After the `updateTask` function (after line 64), add:

```tsx
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const deleteTask = async () => {
    setDeleting(true)
    setDeleteError(null)
    const { error } = await (supabase.from('tasks') as any).delete().eq('id', taskId)
    if (error) {
      setDeleteError(error.message)
      setDeleting(false)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
    queryClient.invalidateQueries({ queryKey: ['my-tasks'] })
    setDeleting(false)
    setDeleteOpen(false)
    onClose()
  }
```

- [ ] **Step 3: Add the "⋯" menu to the header**

Replace the header block:

```tsx
      <div className="flex items-center justify-between border-b border-border bg-background/55 p-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="capitalize">{getTaskStatusLabel(task.status)}</Badge>
          <Badge variant="secondary" className="capitalize">{task.priority}</Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onClose}>
          <X size={16} />
        </Button>
      </div>
```

with:

```tsx
      <div className="flex items-center justify-between border-b border-border bg-background/55 p-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="capitalize">{getTaskStatusLabel(task.status)}</Badge>
          <Badge variant="secondary" className="capitalize">{task.priority}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                <MoreHorizontal size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 size={14} />
                Delete task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>
      </div>
```

(`DropdownMenuItem` supports a `variant="destructive"` prop per shadcn conventions —
if `npx tsc` flags it as unknown, fall back to `className="text-destructive"` instead
of `variant="destructive"`.)

- [ ] **Step 4: Add the confirmation dialog**

At the end of the component's JSX, just before the closing `</div>` of the root
element (after the `</ScrollArea>`), add:

```tsx
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete task?</DialogTitle>
            <DialogDescription>
              This will also delete its subtasks, comments, and links. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteTask} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 5: Add title-blur empty guard**

Replace the title `Input`:

```tsx
          <Input
            value={task.title}
            onChange={e => setTask(prev => prev ? { ...prev, title: e.target.value } : prev)}
            onBlur={e => updateTask({ title: e.target.value })}
            className="h-auto border-transparent bg-transparent px-0 text-lg font-semibold leading-tight focus-visible:ring-0"
          />
```

with:

```tsx
          <Input
            value={task.title}
            onChange={e => setTask(prev => prev ? { ...prev, title: e.target.value } : prev)}
            onBlur={e => {
              const trimmed = e.target.value.trim()
              if (!trimmed) {
                setTask(prev => prev ? { ...prev, title: task.title } : prev)
                return
              }
              if (trimmed !== task.title) updateTask({ title: trimmed })
            }}
            className="h-auto border-transparent bg-transparent px-0 text-lg font-semibold leading-tight focus-visible:ring-0"
          />
```

Note: `task.title` in the closure refers to the value at render time (the last saved
title), so on blur with an empty value the field resets to that saved title without
calling `updateTask`. Non-empty changed values save as before (trimmed).

- [ ] **Step 6: Verify it builds**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors in `task-detail-panel.tsx`. If `DropdownMenuItem`'s `variant`
prop causes a type error, switch to `className="text-destructive focus:text-destructive"`
and re-run.

- [ ] **Step 7: Commit**

```bash
git add components/tasks/task-detail-panel.tsx
git commit -m "feat: add task delete action and title-blur validation"
```

---

## Task 12: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors (existing warnings, if any, are pre-existing and out of scope).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual smoke test (dev server)**

Run: `npm run dev` (background), then in a browser:
1. Open a project board — confirm columns render normally (or skeletons briefly on
   slow network throttling).
2. Open the Agents page → Run Log tab. Trigger `/api/agent/run` (e.g. via `curl -X POST
   http://localhost:3000/api/agent/run -H "X-Relay-Run-Token: $RELAY_RUN_TOKEN"` using
   the configured `RELAY_RUN_TOKEN`/`AGENT_API_SECRET`) and confirm a new "triggered"
   row appears in the Run Log **without reloading the page**.
3. Open a task's detail panel, clear the title field and blur — confirm the title
   reverts to its previous value instead of saving empty.
4. Open a task's "⋯" menu → Delete task → confirm dialog → Delete. Confirm the task
   disappears from the board/list and the panel closes.
5. Stop the dev server when done.

- [ ] **Step 5: Final commit (if any fixups were needed)**

```bash
git add -A
git commit -m "chore: sprint 1 verification fixups"
```

(Skip this commit if no fixups were needed.)
