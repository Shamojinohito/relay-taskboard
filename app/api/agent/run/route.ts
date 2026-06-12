// app/api/agent/run/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const STALE_TASK_HOURS = 72

export async function POST(request: Request) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  const runToken = request.headers.get('X-Relay-Run-Token')
  const expectedRunToken = process.env.RELAY_RUN_TOKEN ?? process.env.AGENT_API_SECRET

  if (!user && (!expectedRunToken || runToken !== expectedRunToken)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const staleBefore = new Date(Date.now() - STALE_TASK_HOURS * 60 * 60 * 1000).toISOString()

  await (supabase.from('tasks') as any)
    .update({
      status: 'blocked',
      blocked_reason: '72時間変化なし',
      handoff_note: 'Dispatcher marked this task as blocked because the status did not change for 72 hours.',
    })
    .lt('last_status_changed_at', staleBefore)
    .not('status', 'in', '("blocked","done")')

  const { data: agents } = await (supabase.from('agents') as any)
    .select('id, name')

  if (!agents?.length) return NextResponse.json({ message: 'No agents configured' })

  const runs = agents.map((agent: { id: string; name: string }) => ({
    agent_id: agent.id,
    trigger: 'manual',
    status: 'completed',
    summary: `Manual dispatcher check triggered. ${agent.name} should process one assigned task at a time and ignore tasks tagged dispatcher-lock.`,
  }))

  await (supabase.from('agent_runs') as any).insert(runs)

  return NextResponse.json({
    message: 'Agent run triggered',
    agentCount: agents.length,
    instruction: 'Agents should poll GET /api/agent/tasks, pick one assigned backlog/todo task by priority, then PATCH handoff_note, status, blocked_reason, and comment as needed.',
  })
}
