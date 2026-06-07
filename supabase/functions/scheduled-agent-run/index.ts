import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: agents } = await supabase.from('agents').select('id, name')

  if (agents?.length) {
    const runs = agents.map((agent: { id: string; name: string }) => ({
      agent_id: agent.id,
      trigger: 'scheduled',
      status: 'completed',
      summary: `Scheduled check triggered. ${agent.name} should poll assigned tasks.`,
    }))
    await supabase.from('agent_runs').insert(runs)
  }

  return new Response(JSON.stringify({ ok: true, agents: agents?.length ?? 0 }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
