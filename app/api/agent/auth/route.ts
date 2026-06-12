// app/api/agent/auth/route.ts
import { NextResponse } from 'next/server'
import { validateAgentApiKey } from '@/lib/agents/auth'
import { SignJWT } from 'jose'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body?.api_key) return NextResponse.json({ error: 'api_key required' }, { status: 400 })

  const agent = await validateAgentApiKey(body.api_key)
  if (!agent) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

  const secret = new TextEncoder().encode(process.env.AGENT_API_SECRET!)
  const scopes = agent.scopes?.length ? agent.scopes : ['read:tasks']
  const token = await new SignJWT({ agentId: agent.id, agentName: agent.name, scopes })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(secret)

  return NextResponse.json({ token, agent: { id: agent.id, name: agent.name, type: agent.type, scopes } })
}
