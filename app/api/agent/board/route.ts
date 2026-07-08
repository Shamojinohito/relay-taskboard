// app/api/agent/board/route.ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAgentFromRequest, writeAgentAuditLog } from '@/lib/agents/api'

export async function GET(request: Request) {
  const agent = await getAgentFromRequest(request, ['read:tasks'])
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const statuses = searchParams.get('status')?.split(',').filter(Boolean)

  const supabase = createServiceClient()

  // エージェントに project_ids が設定されていればそのプロジェクトに限定
  const { data: agentRow } = await (supabase.from('agents') as any)
    .select('project_ids')
    .eq('id', agent.agentId)
    .maybeSingle()

  let query = (supabase.from('tasks') as any)
    .select('id, project_id, parent_task_id, title, description, status, priority, action_type, handoff_note, blocked_reason, due_date, assignee_agent_id, assignee_user_id, updated_at, last_status_changed_at')

  if (agentRow?.project_ids?.length) query = query.in('project_id', agentRow.project_ids)
  if (statuses?.length) query = query.in('status', statuses)

  const { data, error } = await query
    .order('priority', { ascending: false })
    .order('due_date', { ascending: true, nullsFirst: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAgentAuditLog({
    action: 'tasks.board_read',
    agentId: agent.agentId,
    metadata: { statuses: statuses ?? null, count: data?.length ?? 0 },
    requestId: request.headers.get('X-Request-Id'),
  })

  return NextResponse.json({ tasks: data })
}
