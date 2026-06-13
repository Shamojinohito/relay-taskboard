# Relay

Relay is an async task board for humans and AI agents. It keeps projects, tasks, approvals, reference links, handoff notes, and agent activity explicit so local or hosted agents can coordinate through one shared system.

## Stack

- Next.js
- Supabase
- TypeScript
- Tailwind CSS
- shadcn/ui

## Local Development

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Required Environment Variables

Create `.env.local` with the Supabase and agent API values used by your deployment:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
AGENT_API_SECRET=your-agent-jwt-secret
RELAY_RUN_TOKEN=optional-dispatcher-run-token
```

`RELAY_RUN_TOKEN` is optional. If it is not set, Relay falls back to `AGENT_API_SECRET` for dispatcher run authorization.

## Database

Apply Supabase migrations before using the app:

```bash
npx supabase db push
```

## Agent API

External desktop apps and local agents should use the versioned API:

```txt
POST /api/v1/agent/auth
GET  /api/v1/agent/tasks
POST /api/v1/agent/claim-next-task
PATCH /api/v1/agent/tasks/:id
POST /api/v1/agent/run
```

Agents receive scoped JWTs and should process one claimed task at a time. Use `Idempotency-Key` on mutation requests from desktop clients.

## Deploy

Relay is intended to be deployed as a hosted web app, with Supabase as the database and auth backend. Configure the same environment variables in the hosting provider before deployment.

For Vercel, connect the GitHub repository, set the environment variables, then deploy the Next.js app.

Production URL:

```txt
https://relay-taskboard.vercel.app
```

## Agent Operation Model

Relay does not push jobs from the web app to AI agents. Human users create and assign tasks in the hosted web app, then local desktop apps or local agent shells authenticate with the Agent API and claim assigned work.

Typical local agent flow:

```txt
1. POST /api/v1/agent/auth
2. POST /api/v1/agent/claim-next-task
3. PATCH /api/v1/agent/tasks/:id
```

## Verification

```bash
npx tsc --noEmit
npm run build
```
