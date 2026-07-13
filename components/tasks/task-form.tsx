// components/tasks/task-form.tsx
'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useProjects } from '@/hooks/use-projects'
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
import DatePicker from './date-picker'
import AssigneeSelect, { fromAssigneeValue, type AssigneeValue } from './assignee-select'
import { TASK_ACTION_TYPES, TASK_ACTION_TYPE_LABELS, type TaskActionType } from '@/lib/task-workflow'

interface TaskFormProps {
  /** 指定するとプロジェクト固定。省略時はフォーム内でプロジェクトを選択する */
  projectId?: string
  initialStatus: string
  parentTaskId?: string
  /** projectId 省略時の初期選択プロジェクト */
  defaultProjectId?: string
  /** 期日の初期値（YYYY-MM-DD。Today ビューからの追加用） */
  defaultDueDate?: string
  /** 担当者の初期値を自分にする（My Tasks ビューからの追加用） */
  assignToMe?: boolean
  onClose: () => void
}

export default function TaskForm({
  projectId,
  initialStatus,
  parentTaskId,
  defaultProjectId,
  defaultDueDate,
  assignToMe,
  onClose,
}: TaskFormProps) {
  const fixedProject = Boolean(projectId)
  const { projects } = useProjects()
  const [selectedProjectId, setSelectedProjectId] = useState(projectId ?? defaultProjectId ?? '')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium')
  const [actionType, setActionType] = useState<TaskActionType>('other')
  const [dueDate, setDueDate] = useState(defaultDueDate ?? '')
  const [assignee, setAssignee] = useState<AssigneeValue>('none')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const queryClient = useQueryClient()
  const supabase = createClient()

  // プロジェクト一覧は非同期で届くため、未選択なら先頭を初期値にする
  useEffect(() => {
    if (fixedProject || selectedProjectId) return
    const first = (projects as any[])[0]
    if (first) setSelectedProjectId(defaultProjectId ?? first.id)
  }, [fixedProject, selectedProjectId, defaultProjectId, projects])

  useEffect(() => {
    if (!assignToMe) return
    let mounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (mounted && data.user) {
        setAssignee(current => current === 'none' ? `user:${data.user!.id}` : current)
      }
    })
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignToMe])

  const handleCreate = async () => {
    if (!title.trim() || !selectedProjectId) return
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
        project_id: selectedProjectId,
        parent_task_id: parentTaskId ?? null,
        title: title.trim(),
        description: description.trim() || null,
        status: initialStatus,
        priority,
        action_type: actionType,
        due_date: dueDate || null,
        ...fromAssigneeValue(assignee),
        created_by_user_id: user.id,
      })
      .select(`
        *,
        task_tags(tag_id, tags(id, name, color)),
        task_links(id, url, title),
        assignee_agent:assignee_agent_id(id, name, type)
      `)
      .single()

    if (error) {
      setErrorMessage(error.message)
      setLoading(false)
      return
    }

    if (task && !parentTaskId) {
      queryClient.setQueryData(['tasks', selectedProjectId], (current: unknown) => {
        if (!Array.isArray(current)) return [task]
        if (current.some((item: any) => item.id === task.id)) return current
        return [...current, task]
      })
    }

    await queryClient.invalidateQueries({ queryKey: ['tasks', selectedProjectId] })
    queryClient.invalidateQueries({ queryKey: ['triage-inbox'] })
    queryClient.invalidateQueries({ queryKey: ['my-tasks'] })
    queryClient.invalidateQueries({ queryKey: ['today-tasks'] })
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
          {!fixedProject && (
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={selectedProjectId} onValueChange={v => v && setSelectedProjectId(v)}>
                <SelectTrigger>
                  <SelectValue>
                    {(v: string) => (projects as any[]).find(p => p.id === v)?.name ?? 'Select project'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(projects as any[]).map(project => (
                    <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
              <DatePicker value={dueDate} onChange={setDueDate} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Action Type</Label>
            <Select value={actionType} onValueChange={v => setActionType(v as TaskActionType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TASK_ACTION_TYPES.map(type => (
                  <SelectItem key={type} value={type}>{TASK_ACTION_TYPE_LABELS[type]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Assignee</Label>
            <AssigneeSelect value={assignee} onChange={setAssignee} className="w-full" />
          </div>
          {errorMessage && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={loading || !title.trim() || !selectedProjectId}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
