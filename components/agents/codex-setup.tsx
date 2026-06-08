'use client'

import { Copy, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'

const LOCAL_BASE_URL = 'http://localhost:3000'

function CodeBlock({ children }: { children: string }) {
  return (
    <div className="group relative rounded-lg border border-border bg-background p-3">
      <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
        <code>{children}</code>
      </pre>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={() => navigator.clipboard.writeText(children)}
      >
        <Copy size={13} />
      </Button>
    </div>
  )
}

export function CodexSetup() {
  const authExample = `curl -X POST ${LOCAL_BASE_URL}/api/agent/auth \\
  -H "Content-Type: application/json" \\
  -d '{"api_key":"sk-agent-..."}'`

  const tasksExample = `curl ${LOCAL_BASE_URL}/api/agent/tasks?status=backlog \\
  -H "Authorization: Bearer <token>"`

  const updateExample = `curl -X PATCH ${LOCAL_BASE_URL}/api/agent/tasks/<task-id> \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "status": "in_progress",
    "comment": "Codex picked this up and started work."
  }'`

  const codexPrompt = `You can access AirFlow TaskBoard through its Agent API.

Base URL: ${LOCAL_BASE_URL}
1. Authenticate with POST /api/agent/auth using the assigned agent API key.
2. Read assigned tasks with GET /api/agent/tasks.
3. Update task status or add instructions with PATCH /api/agent/tasks/:id.
4. Record all handoffs and decisions as task comments.`

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-2">
          <Terminal size={16} className="text-primary" />
          <h2 className="text-base font-semibold">Codex Access</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Codex connects as an AirFlow agent. Create an agent API key, give it to Codex, then let Codex poll and update assigned tasks through the Agent API.
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-medium">1. Create an Agent API key</h3>
        <p className="text-sm text-muted-foreground">
          Open the Agents tab, create a new agent such as <span className="text-foreground">CodexAgent</span>, and copy the API key shown once after creation.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium">2. Authenticate from Codex</h3>
        <CodeBlock>{authExample}</CodeBlock>
        <p className="text-sm text-muted-foreground">
          The response contains a 24-hour bearer token. Codex should use this token for subsequent requests.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium">3. Read assigned tasks</h3>
        <CodeBlock>{tasksExample}</CodeBlock>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium">4. Update status and leave comments</h3>
        <CodeBlock>{updateExample}</CodeBlock>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium">Codex instruction snippet</h3>
        <CodeBlock>{codexPrompt}</CodeBlock>
      </section>
    </div>
  )
}
