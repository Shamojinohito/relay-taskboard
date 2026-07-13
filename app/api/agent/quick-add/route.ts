// app/api/agent/quick-add/route.ts
// クイックキャプチャ用エンドポイント。X-Api-Key でAPIキーを直接受け（JWT交換不要）、
// テキスト1本をパースしてタスクを作成する。
// 仕様: docs/superpowers/specs/2026-07-13-quick-capture-design.md
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validateAgentApiKey } from '@/lib/agents/auth'
import { writeAgentAuditLog } from '@/lib/agents/api'
import { parseQuickAdd, jstToday, QuickAddError } from '@/lib/quick-add/parse'

export async function POST(request: Request) {
  const apiKey = request.headers.get('X-Api-Key')
  if (!apiKey) return NextResponse.json({ error: 'X-Api-Key header required' }, { status: 401 })

  const agent = await validateAgentApiKey(apiKey)
  if (!agent || !agent.scopes?.includes('write:tasks')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (typeof body?.text !== 'string' || !body.text.trim()) {
    return NextResponse.json({ error: 'text required' }, { status: 400 })
  }

  let parsed
  try {
    parsed = parseQuickAdd(body.text, jstToday())
  } catch (e) {
    if (e instanceof QuickAddError) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    throw e
  }

  const supabase = createServiceClient()

  const { data: project, error: projectError } = await (supabase.from('projects') as any)
    .select('id, name')
    .eq('name', parsed.projectName)
    .is('archived_at', null)
    .single()
  if (projectError || !project) {
    return NextResponse.json(
      { error: `${parsed.projectName} project not found` },
      { status: 500 }
    )
  }

  const { data: task, error } = await (supabase.from('tasks') as any)
    .insert({
      project_id: project.id,
      title: parsed.title,
      status: 'todo',
      priority: parsed.priority,
      action_type: 'other',
      due_date: parsed.dueDate,
      created_by_agent_id: agent.id,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAgentAuditLog({
    action: 'tasks.quick_add',
    agentId: agent.id,
    metadata: { source: body.source ?? null, text: body.text },
    requestId: request.headers.get('X-Request-Id'),
    taskId: task.id,
  })

  // クライアントが通知にそのまま使える1行サマリー
  const extras = [
    parsed.dueDate ? `due ${parsed.dueDate}` : null,
    parsed.priority !== 'medium' ? parsed.priority : null,
  ].filter(Boolean)
  const summary =
    `${parsed.projectName}: ${parsed.title}` + (extras.length ? ` (${extras.join(', ')})` : '')

  return NextResponse.json({ task, parsed, summary }, { status: 201 })
}
