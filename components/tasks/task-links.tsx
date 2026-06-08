'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, LinkIcon, Plus, Trash2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface TaskLink {
  id: string
  url: string
  title: string | null
}

interface TaskLinksProps {
  taskId: string
  projectId: string
}

function normalizeUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export default function TaskLinks({ taskId, projectId }: TaskLinksProps) {
  const [links, setLinks] = useState<TaskLink[]>([])
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const supabase = createClient()
  const queryClient = useQueryClient()

  const refreshTaskCache = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
    queryClient.invalidateQueries({ queryKey: ['my-tasks'] })
  }

  useEffect(() => {
    ;(supabase.from('task_links') as any)
      .select('id, url, title')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })
      .then(({ data }: { data: TaskLink[] | null }) => setLinks(data ?? []))
  }, [taskId])

  const addLink = async () => {
    const normalizedUrl = normalizeUrl(url)
    if (!normalizedUrl) return

    setErrorMessage('')
    const { data, error } = await (supabase.from('task_links') as any)
      .insert({
        task_id: taskId,
        url: normalizedUrl,
        title: title.trim() || null,
      })
      .select('id, url, title')
      .single()

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setLinks(current => [...current, data])
    setUrl('')
    setTitle('')
    refreshTaskCache()
  }

  const deleteLink = async (id: string) => {
    const { error } = await (supabase.from('task_links') as any).delete().eq('id', id)
    if (error) {
      setErrorMessage(error.message)
      return
    }
    setLinks(current => current.filter(link => link.id !== id))
    refreshTaskCache()
  }

  return (
    <div className="space-y-2">
      {links.length > 0 && (
        <div className="space-y-1">
          {links.map(link => (
            <div key={link.id} className="flex items-center gap-2 rounded-lg border border-border bg-background/35 p-2 text-sm">
              <LinkIcon size={14} className="text-muted-foreground" />
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-primary hover:underline"
              >
                {link.title || link.url}
              </a>
              <ExternalLink size={13} className="text-muted-foreground" />
              <Button variant="ghost" size="icon-sm" onClick={() => deleteLink(link.id)}>
                <Trash2 size={13} />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-lg border border-border bg-background/35 p-2">
        <Input value={url} onChange={event => setUrl(event.target.value)} placeholder="https://..." className="h-8" />
        <Input value={title} onChange={event => setTitle(event.target.value)} placeholder="Title" className="h-8" />
        <Button size="icon-sm" onClick={addLink} disabled={!url.trim()}>
          <Plus size={14} />
        </Button>
      </div>

      {errorMessage && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
