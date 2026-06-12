// app/api/agent/tasks/[id]/route.ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAgentFromRequest, writeAgentAuditLog } from '@/lib/agents/api'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const {
    action_type,
    blocked_reason,
    comment,
    handoff_note,
    priority,
    assignee_agent_id,
    assignee_user_id,
    status,
  } = body
  const requiredScopes = comment ? ['write:tasks', 'write:comments'] as const : ['write:tasks'] as const
  const agent = await getAgentFromRequest(request, [...requiredScopes])
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const updates: Record<string, unknown> = {}
  if (status) updates.status = status
  if (priority) updates.priority = priority
  if (action_type) updates.action_type = action_type
  if (handoff_note !== undefined) updates.handoff_note = handoff_note || null
  if (blocked_reason !== undefined) updates.blocked_reason = blocked_reason || null
  if (assignee_user_id !== undefined) {
    updates.assignee_user_id = assignee_user_id
    updates.assignee_agent_id = null
  }
  if (assignee_agent_id !== undefined) {
    updates.assignee_agent_id = assignee_agent_id
    updates.assignee_user_id = null
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await (supabase.from('tasks') as any).update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (comment) {
    await (supabase.from('task_comments') as any).insert({
      task_id: id, body: comment, author_agent_id: agent.agentId
    })
  }

  await writeAgentAuditLog({
    action: 'tasks.patch',
    agentId: agent.agentId,
    idempotencyKey: request.headers.get('Idempotency-Key'),
    metadata: { fields: Object.keys(updates), comment: Boolean(comment) },
    requestId: request.headers.get('X-Request-Id'),
    taskId: id,
  })

  return NextResponse.json({ success: true })
}
