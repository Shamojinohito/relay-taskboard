// app/api/agent/projects/route.ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAgentFromRequest, writeAgentAuditLog } from '@/lib/agents/api'

export async function GET(request: Request) {
  const agent = await getAgentFromRequest(request, ['read:tasks'])
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  // エージェントに project_ids が設定されていればそのプロジェクトに限定
  const { data: agentRow } = await (supabase.from('agents') as any)
    .select('project_ids')
    .eq('id', agent.agentId)
    .maybeSingle()

  let query = (supabase.from('projects') as any)
    .select('id, name, description, created_at')
    .is('archived_at', null)

  if (agentRow?.project_ids?.length) query = query.in('id', agentRow.project_ids)

  const { data, error } = await query.order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAgentAuditLog({
    action: 'projects.list',
    agentId: agent.agentId,
    metadata: { count: data?.length ?? 0 },
    requestId: request.headers.get('X-Request-Id'),
  })

  return NextResponse.json({ projects: data })
}
