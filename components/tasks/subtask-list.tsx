// components/tasks/subtask-list.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { GitBranch, ListChecks, Plus } from 'lucide-react'

interface Subtask {
  id: string
  title: string
  status: string
}

interface SubtaskListProps {
  parentTaskId: string
  projectId: string
}

export default function SubtaskList({ parentTaskId, projectId }: SubtaskListProps) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [newTitle, setNewTitle] = useState('')
  const supabase = createClient()
  const queryClient = useQueryClient()
  const completedCount = subtasks.filter(subtask => subtask.status === 'done').length

  useEffect(() => {
    ;(supabase.from('tasks') as any)
      .select('id, title, status')
      .eq('parent_task_id', parentTaskId)
      .order('created_at')
      .then(({ data }: { data: Subtask[] | null }) => setSubtasks(data ?? []))
  }, [parentTaskId])

  const addSubtask = async () => {
    if (!newTitle.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await (supabase.from('tasks') as any).insert({
      project_id: projectId,
      parent_task_id: parentTaskId,
      title: newTitle.trim(),
      status: 'todo',
      priority: 'medium',
      created_by_user_id: user?.id,
    }).select('id, title, status').single()
    if (data) setSubtasks(prev => [...prev, data as Subtask])
    setNewTitle('')
    queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
  }

  const toggleSubtask = async (subtask: Subtask) => {
    const newStatus = subtask.status === 'done' ? 'todo' : 'done'
    await (supabase.from('tasks') as any).update({ status: newStatus }).eq('id', subtask.id)
    setSubtasks(prev => prev.map(s => s.id === subtask.id ? { ...s, status: newStatus } : s))
    queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <ListChecks size={13} />
          {completedCount}/{subtasks.length} complete
        </span>
      </div>
      {subtasks.map(sub => (
        <div key={sub.id} className="flex items-center gap-2 rounded-md border border-border/60 bg-background/45 px-2 py-1.5">
          <GitBranch size={12} className="text-muted-foreground" />
          <Checkbox checked={sub.status === 'done'} onCheckedChange={() => toggleSubtask(sub)} />
          <span className={`text-sm ${sub.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {sub.title}
          </span>
        </div>
      ))}
      <div className="flex gap-2 mt-2">
        <Input value={newTitle} onChange={e => setNewTitle(e.target.value)}
          placeholder="Add subtask..." className="h-8 text-sm"
          onKeyDown={e => e.key === 'Enter' && addSubtask()} />
        <Button size="sm" variant="ghost" onClick={addSubtask} className="h-8">
          <Plus size={14} />
        </Button>
      </div>
    </div>
  )
}
