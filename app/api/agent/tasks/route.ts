// app/api/agent/tasks/route.ts
import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { createServiceClient } from '@/lib/supabase/service'

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

  const supabase = createServiceClient()
  let query = (supabase.from('tasks') as any)
    .select('*, task_comments(id, body, created_at, author_agent_id)')
    .eq('assignee_agent_id', agent.agentId)

  if (status) query = query.eq('status', status)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ tasks: data })
}
