import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAgentFromRequest, writeAgentAuditLog } from '@/lib/agents/api'

export async function POST(request: Request) {
  const agent = await getAgentFromRequest(request, ['claim:tasks'])
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const idempotencyKey = request.headers.get('Idempotency-Key')
  const requestId = request.headers.get('X-Request-Id')

  if (idempotencyKey) {
    const { data: previous } = await (supabase.from('agent_audit_logs') as any)
      .select('metadata')
      .eq('agent_id', agent.agentId)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()

    const previousTask = previous?.metadata?.task
    if (previousTask) {
      return NextResponse.json({ task: previousTask, idempotent: true })
    }
  }

  const { data, error } = await ((supabase as any).rpc('claim_next_agent_task', {
    p_agent_id: agent.agentId,
  }) as any)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const task = Array.isArray(data) ? data[0] : null

  if (task) {
    await (supabase.from('task_comments') as any).insert({
      task_id: task.id,
      author_agent_id: agent.agentId,
      body: `${agent.agentName} claimed this task and moved it to In Progress.`,
    })
  }

  await writeAgentAuditLog({
    action: 'tasks.claim_next',
    agentId: agent.agentId,
    idempotencyKey,
    metadata: { task: task ?? null },
    requestId,
    taskId: task?.id ?? null,
  })

  return NextResponse.json({ task: task ?? null })
}
