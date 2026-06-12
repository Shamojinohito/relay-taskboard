import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  const staleBefore = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()

  await supabase
    .from('tasks')
    .update({
      status: 'blocked',
      blocked_reason: '72時間変化なし',
      handoff_note: 'Dispatcher marked this task as blocked because the status did not change for 72 hours.',
    })
    .lt('last_status_changed_at', staleBefore)
    .not('status', 'in', '("blocked","done")')

  const { data: agents } = await supabase.from('agents').select('id, name')

  if (agents?.length) {
    const runs = agents.map((agent: { id: string; name: string }) => ({
      agent_id: agent.id,
      trigger: 'scheduled',
      status: 'completed',
      summary: `Scheduled dispatcher check triggered. ${agent.name} should process one assigned task at a time and ignore tasks tagged dispatcher-lock.`,
    }))
    await supabase.from('agent_runs').insert(runs)
  }

  return new Response(JSON.stringify({ ok: true, agents: agents?.length ?? 0 }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
