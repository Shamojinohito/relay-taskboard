'use client'

import { Bot, CheckCircle2, KeyRound, Workflow } from 'lucide-react'
import CopyableCode from '@/components/settings/copyable-code'
import { ClaudeLogo } from '@/components/settings/brand-logos'

const LOCAL_BASE_URL = 'http://localhost:3000'

export default function ClaudeCodeSetup() {
  const envExample = `export RELAY_BASE_URL="${LOCAL_BASE_URL}"
export RELAY_AGENT_API_KEY="sk-agent-..."`

  const authExample = `curl -X POST "$RELAY_BASE_URL/api/agent/auth" \\
  -H "Content-Type: application/json" \\
  -d '{"api_key":"'"$RELAY_AGENT_API_KEY"'"}'`

  const tasksExample = `TOKEN="<paste-token-from-auth-response>"

curl "$RELAY_BASE_URL/api/agent/tasks?status=backlog" \\
  -H "Authorization: Bearer $TOKEN"`

  const updateExample = `curl -X PATCH "$RELAY_BASE_URL/api/agent/tasks/<task-id>" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "status": "in_progress",
    "comment": "Claude Code picked this up and started work."
  }'`

  const claudePrompt = `You can access Relay through the Agent API.

Base URL: ${LOCAL_BASE_URL}
Agent API key: use RELAY_AGENT_API_KEY from the local shell environment.

Workflow:
1. Authenticate with POST /api/agent/auth.
2. Read assigned work with GET /api/agent/tasks.
3. Use status filters such as backlog, todo, in_progress, on_hold, blocked, in_review, done.
4. Process one assigned task at a time. Treat urgent, high, medium, then low as priority order.
5. When you start work, PATCH the task to in_progress and add a comment.
6. Record handoffs in handoff_note, blockers in blocked_reason, and detailed activity in comments.
7. Do not automatically execute tasks tagged dispatcher-lock.
8. When human approval is needed, assign the task to the human owner or move it to blocked with a clear blocked_reason.`

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-card/80 p-4">
        <div className="mb-2 flex items-center gap-2">
          <ClaudeLogo className="size-5" />
          <h2 className="text-base font-semibold">Claude Code Setup</h2>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          Claude Code connects to Relay as an agent. Create an Agent API key, expose it to the Claude Code shell, then let Claude authenticate, poll assigned tasks, and write progress back through the Agent API.
        </p>
      </div>

      <section className="grid gap-3 rounded-lg border border-border bg-card/60 p-4">
        <div className="flex items-center gap-2">
          <Bot size={15} className="text-primary" />
          <h3 className="text-sm font-medium">1. Create a Claude agent</h3>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          Open Agents, create an agent named <span className="text-foreground">ClaudeCodeAgent</span>, choose Worker or Custom, and copy the API key shown after creation. The key is shown only once.
        </p>
      </section>

      <section className="grid gap-3 rounded-lg border border-border bg-card/60 p-4">
        <div className="flex items-center gap-2">
          <KeyRound size={15} className="text-primary" />
          <h3 className="text-sm font-medium">2. Set local shell variables</h3>
        </div>
        <CopyableCode>{envExample}</CopyableCode>
        <p className="text-xs leading-5 text-muted-foreground">
          Keep the Agent API key in your shell or secret manager. Do not put it in source control.
        </p>
      </section>

      <section className="grid gap-3 rounded-lg border border-border bg-card/60 p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={15} className="text-primary" />
          <h3 className="text-sm font-medium">3. Verify API access</h3>
        </div>
        <CopyableCode>{authExample}</CopyableCode>
        <CopyableCode>{tasksExample}</CopyableCode>
      </section>

      <section className="grid gap-3 rounded-lg border border-border bg-card/60 p-4">
        <div className="flex items-center gap-2">
          <Workflow size={15} className="text-primary" />
          <h3 className="text-sm font-medium">4. Update tasks from Claude Code</h3>
        </div>
        <CopyableCode>{updateExample}</CopyableCode>
      </section>

      <section className="grid gap-3 rounded-lg border border-border bg-card/60 p-4">
        <h3 className="text-sm font-medium">Claude Code instruction snippet</h3>
        <CopyableCode>{claudePrompt}</CopyableCode>
      </section>
    </div>
  )
}
