'use client'

import { useEffect, useMemo, useState } from 'react'
import { addMonths, format, getDay, isSameDay, isToday, isValid, parse, parseISO, startOfMonth, subMonths } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export default function DatePicker({ value, onChange, className }: DatePickerProps) {
  const selectedDate = value ? parseISO(value) : null
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState(() => selectedDate ? format(selectedDate, 'yyyy.MM.dd') : '')
  const [visibleMonth, setVisibleMonth] = useState(() => selectedDate ?? new Date())

  useEffect(() => {
    setInputValue(selectedDate ? format(selectedDate, 'yyyy.MM.dd') : '')
  }, [value])

  const days = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth)
    const leadingBlanks = getDay(monthStart)
    const dates: (Date | null)[] = Array.from({ length: leadingBlanks }, () => null)
    const cursor = new Date(monthStart)

    while (cursor.getMonth() === monthStart.getMonth()) {
      dates.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }

    while (dates.length % 7 !== 0) dates.push(null)
    return dates
  }, [visibleMonth])

  const selectDate = (date: Date) => {
    onChange(format(date, 'yyyy-MM-dd'))
    setInputValue(format(date, 'yyyy.MM.dd'))
    setOpen(false)
  }

  const handleTextChange = (text: string) => {
    setInputValue(text)

    if (!text.trim()) {
      onChange('')
      return
    }

    const parsedDate = parse(text, 'yyyy.MM.dd', new Date())
    if (isValid(parsedDate)) {
      onChange(format(parsedDate, 'yyyy-MM-dd'))
    }
  }

  return (
    <div className={cn('relative', className)}>
      <div className="flex h-8 w-full rounded-lg border border-input bg-transparent dark:bg-input/30">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="h-full rounded-r-none border-r border-border px-2"
          onClick={() => setOpen(current => !current)}
        >
          <CalendarDays size={14} />
          <span className="sr-only">Open calendar</span>
        </Button>
        <Input
          type="text"
          value={inputValue}
          onChange={event => handleTextChange(event.target.value)}
          placeholder="yyyy.MM.dd"
          className="h-full flex-1 border-0 bg-transparent px-2 text-sm focus-visible:ring-0"
        />
      </div>

      {open && (
        <div className="absolute z-50 mt-2 w-64 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-md">
          <div className="mb-3 flex items-center justify-between">
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => setVisibleMonth(month => subMonths(month, 1))}>
              <ChevronLeft size={14} />
            </Button>
            <span className="text-sm font-medium">{format(visibleMonth, 'MMMM yyyy')}</span>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => setVisibleMonth(month => addMonths(month, 1))}>
              <ChevronRight size={14} />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
            {WEEKDAYS.map(day => <div key={day}>{day}</div>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((date, index) => (
              <button
                key={date ? date.toISOString() : `blank-${index}`}
                type="button"
                disabled={!date}
                onClick={() => date && selectDate(date)}
                className={cn(
                  'h-7 rounded-md text-sm text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-0',
                  // 今日のセルは枠線で示す（選択日の塗りつぶしが優先）
                  date && isToday(date) && !(selectedDate && isSameDay(date, selectedDate)) &&
                    'ring-1 ring-primary/60 font-medium text-primary',
                  date && selectedDate && isSameDay(date, selectedDate) && 'bg-primary text-primary-foreground hover:bg-primary'
                )}
              >
                {date ? date.getDate() : ''}
              </button>
            ))}
          </div>

          <div className="mt-3 flex justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={() => setVisibleMonth(new Date())}>
              Today
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" onClick={() => { onChange(''); setOpen(false) }}>
                <X size={13} />
                Clear
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
