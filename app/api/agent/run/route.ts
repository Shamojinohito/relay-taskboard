// app/api/agent/run/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()

  const { data: agents } = await (supabase.from('agents') as any)
    .select('id, name')

  if (!agents?.length) return NextResponse.json({ message: 'No agents configured' })

  const runs = agents.map((agent: { id: string; name: string }) => ({
    agent_id: agent.id,
    trigger: 'manual',
    status: 'completed',
    summary: `Manual run triggered. ${agent.name} should check assigned tasks.`,
  }))

  await (supabase.from('agent_runs') as any).insert(runs)

  return NextResponse.json({
    message: 'Agent run triggered',
    agentCount: agents.length,
    instruction: 'Agents should poll GET /api/agent/tasks to pick up assigned work.',
  })
}
