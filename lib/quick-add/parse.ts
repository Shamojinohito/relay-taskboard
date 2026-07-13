// lib/quick-add/parse.ts
// クイックキャプチャ記法のパーサー（純関数）。
// 記法仕様: docs/superpowers/specs/2026-07-13-quick-capture-design.md §4

export class QuickAddError extends Error {}

export interface Ymd {
  y: number
  m: number
  d: number
}

export interface ParsedQuickAdd {
  title: string
  projectName: 'Sales' | 'Personal' | 'Second Brain' | 'Inbox'
  dueDate: string | null // YYYY-MM-DD
  priority: 'low' | 'medium' | 'high'
}

const PROJECT_TOKENS: Record<string, ParsedQuickAdd['projectName']> = {
  s: 'Sales',
  p: 'Personal',
  b: 'Second Brain',
}

// Vercel のサーバーは UTC で動くため、「今日」は JST 基準で求める
export function jstToday(): Ymd {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return { y: jst.getUTCFullYear(), m: jst.getUTCMonth() + 1, d: jst.getUTCDate() }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function formatYmd(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`
}

function isValidDate(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

// due: トークンの値部分を解釈する。解釈できなければ null（呼び出し側でタイトルに残す）
function parseDueToken(value: string, today: Ymd): string | null {
  if (value === '今日') return formatYmd(today.y, today.m, today.d)
  if (value === '明日') {
    const dt = new Date(Date.UTC(today.y, today.m - 1, today.d + 1))
    return formatYmd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
  }
  const abs = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (abs) {
    const [y, m, d] = [Number(abs[1]), Number(abs[2]), Number(abs[3])]
    return isValidDate(y, m, d) ? formatYmd(y, m, d) : null
  }
  const md = value.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (md) {
    const [m, d] = [Number(md[1]), Number(md[2])]
    if (!isValidDate(today.y, m, d)) return null
    const isPast = m < today.m || (m === today.m && d < today.d)
    return formatYmd(isPast ? today.y + 1 : today.y, m, d)
  }
  return null
}

export function parseQuickAdd(text: string, today: Ymd = jstToday()): ParsedQuickAdd {
  const tokens = text.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) throw new QuickAddError('text is empty')

  let projectName: ParsedQuickAdd['projectName'] = 'Inbox'
  const first = tokens[0].toLowerCase()
  if (first in PROJECT_TOKENS) {
    projectName = PROJECT_TOKENS[first]
    tokens.shift()
  }

  let dueDate: string | null = null
  let priority: ParsedQuickAdd['priority'] = 'medium'
  const titleTokens: string[] = []

  for (const token of tokens) {
    const lower = token.toLowerCase()
    if (lower === '!high') {
      priority = 'high'
      continue
    }
    if (lower === '!low') {
      priority = 'low'
      continue
    }
    if (lower.startsWith('due:')) {
      const due = parseDueToken(token.slice(4), today)
      if (due) {
        dueDate = due
        continue
      }
    }
    titleTokens.push(token)
  }

  const title = titleTokens.join(' ')
  if (!title) throw new QuickAddError('title is empty')

  return { title, projectName, dueDate, priority }
}
