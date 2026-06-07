// components/tasks/comment-list.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Bot } from 'lucide-react'
import { format } from 'date-fns'

interface Comment {
  id: string
  body: string
  created_at: string
  author_user_id: string | null
  author_agent_id: string | null
  author_agent: { name: string } | null
}

export default function CommentList({ taskId }: { taskId: string }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    ;(supabase.from('task_comments') as any)
      .select('*, author_agent:author_agent_id(name)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })
      .then(({ data }: { data: Comment[] | null }) => setComments(data ?? []))

    const channel = supabase
      .channel(`comments:${taskId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'task_comments',
        filter: `task_id=eq.${taskId}`
      }, (payload: { new: Comment }) => {
        setComments(prev => [...prev, payload.new])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [taskId])

  const addComment = async () => {
    if (!body.trim()) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    await (supabase.from('task_comments') as any).insert({
      task_id: taskId, body: body.trim(), author_user_id: user?.id
    })
    setBody('')
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {comments.map(c => (
          <div key={c.id} className="flex gap-2">
            {c.author_agent ? (
              <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Bot size={14} className="text-primary" />
              </div>
            ) : (
              <Avatar className="h-7 w-7 flex-shrink-0">
                <AvatarFallback className="text-xs">U</AvatarFallback>
              </Avatar>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-foreground">
                  {c.author_agent?.name ?? 'You'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(c.created_at), 'MMM d, HH:mm')}
                </span>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{c.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Textarea value={body} onChange={e => setBody(e.target.value)}
          placeholder="Add a comment or instruction..." rows={3} />
        <Button size="sm" onClick={addComment} disabled={loading || !body.trim()}>
          Comment
        </Button>
      </div>
    </div>
  )
}
