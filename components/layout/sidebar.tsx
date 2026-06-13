'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bot, CheckSquare, FolderKanban, Plus, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useProjects } from '@/hooks/use-projects'
import CreateProjectDialog from '@/components/projects/create-project-dialog'
import { useState } from 'react'
import RelayLogo from '@/components/brand/relay-logo'

export default function Sidebar() {
  const pathname = usePathname()
  const { projects, isLoading, error } = useProjects()
  const [createOpen, setCreateOpen] = useState(false)
  const navItemClassName = (active: boolean) => cn(
    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors",
    active
      ? "bg-primary/12 text-primary ring-1 ring-primary/20"
      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
  )

  return (
    <aside className="flex h-screen w-64 flex-shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3">
          <RelayLogo className="size-9" />
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-wide text-sidebar-foreground">Relay</div>
            <div className="text-[11px] text-muted-foreground">Agent handoff board</div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <nav className="space-y-1 p-3">
          <Link href="/my-tasks" className={navItemClassName(pathname === '/my-tasks')}>
            <CheckSquare size={16} />
            <span>My Tasks</span>
          </Link>

          <div className="px-3 pb-1 pt-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Projects
              </span>
              <Button variant="ghost" size="icon-sm" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => setCreateOpen(true)}>
                <Plus size={13} />
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-1 px-3">
              {[0, 1, 2].map(i => (
                <Skeleton key={i} className="h-8 w-full rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <p className="px-3 py-2 text-xs text-destructive">
              Failed to load projects
            </p>
          ) : (projects as any[]).length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No projects yet. Use the + above to create one.
            </p>
          ) : (
            (projects as any[]).map(project => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className={cn(navItemClassName(pathname.startsWith(`/projects/${project.id}`)), "truncate")}
              >
                <FolderKanban size={15} className="flex-shrink-0" />
                <span className="truncate">{project.name}</span>
              </Link>
            ))
          )}

          <div className="px-3 pb-1 pt-5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Agents
            </span>
          </div>

          <Link href="/agents" className={navItemClassName(pathname === '/agents')}>
            <Bot size={15} />
            <span>Agents</span>
          </Link>

          <Link href="/settings" className={navItemClassName(pathname === '/settings')}>
            <Settings size={15} />
            <span>Settings</span>
          </Link>
        </nav>
      </ScrollArea>

      <div className="border-t border-sidebar-border p-3">
        <div className="rounded-lg border border-border/70 bg-background/45 px-3 py-2 text-xs text-muted-foreground">
          <span className="mr-2 inline-block size-1.5 rounded-full bg-emerald-400" />
          Realtime sync active
        </div>
      </div>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </aside>
  )
}
