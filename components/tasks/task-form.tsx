// components/tasks/task-form.tsx
'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'

interface TaskFormProps {
  projectId: string
  initialStatus: string
  parentTaskId?: string
  onClose: () => void
}

export default function TaskForm({ projectId, initialStatus, parentTaskId, onClose }: TaskFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium')
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const queryClient = useQueryClient()
  const supabase = createClient()

  const handleCreate = async () => {
    if (!title.trim()) return
    setLoading(true)
    setErrorMessage('')

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      setErrorMessage(userError?.message ?? 'ログイン状態を確認できませんでした。再ログインしてください。')
      setLoading(false)
      return
    }

    const { data: task, error } = await (supabase.from('tasks') as any)
      .insert({
        project_id: projectId,
        parent_task_id: parentTaskId ?? null,
        title: title.trim(),
        description: description.trim() || null,
        status: initialStatus,
        priority,
        due_date: dueDate || null,
        created_by_user_id: user.id,
      })
      .select(`
        *,
        task_tags(tag_id, tags(id, name, color)),
        assignee_agent:assignee_agent_id(id, name, type)
      `)
      .single()

    if (error) {
      setErrorMessage(error.message)
      setLoading(false)
      return
    }

    if (task && !parentTaskId) {
      queryClient.setQueryData(['tasks', projectId], (current: unknown) => {
        if (!Array.isArray(current)) return [task]
        if (current.some((item: any) => item.id === task.id)) return current
        return [...current, task]
      })
    }

    await queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
    setLoading(false)
    onClose()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{parentTaskId ? 'Add Subtask' : 'Add Task'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={v => setPriority(v as typeof priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>
          {errorMessage && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={loading || !title.trim()}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
