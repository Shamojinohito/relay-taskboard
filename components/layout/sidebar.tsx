'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CheckSquare, FolderKanban, Bot, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useProjects } from '@/hooks/use-projects'
import CreateProjectDialog from '@/components/projects/create-project-dialog'
import { useState } from 'react'

export default function Sidebar() {
  const pathname = usePathname()
  const { projects, error } = useProjects()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <aside className="w-56 flex-shrink-0 border-r border-border bg-card flex flex-col h-screen">
      <div className="p-4 border-b border-border">
        <span className="text-lg font-bold text-primary">AirFlow</span>
      </div>

      <ScrollArea className="flex-1">
        <nav className="p-2 space-y-1">
          <Link href="/my-tasks">
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer",
              pathname === '/my-tasks'
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}>
              <CheckSquare size={16} />
              <span>My Tasks</span>
            </div>
          </Link>

          <div className="pt-3 pb-1 px-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Projects
              </span>
              <Button variant="ghost" size="icon" className="h-5 w-5"
                onClick={() => setCreateOpen(true)}>
                <Plus size={12} />
              </Button>
            </div>
          </div>

          {(projects as any[]).map(project => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <div className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer truncate",
                pathname.startsWith(`/projects/${project.id}`)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}>
                <FolderKanban size={16} className="flex-shrink-0" />
                <span className="truncate">{project.name}</span>
              </div>
            </Link>
          ))}

          {error && (
            <p className="px-3 py-2 text-xs text-destructive">
              Failed to load projects
            </p>
          )}

          <div className="pt-3 pb-1 px-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Agents
            </span>
          </div>

          <Link href="/agents">
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer",
              pathname === '/agents'
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}>
              <Bot size={16} />
              <span>Agents</span>
            </div>
          </Link>
        </nav>
      </ScrollArea>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </aside>
  )
}
