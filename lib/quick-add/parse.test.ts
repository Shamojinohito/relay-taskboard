import { describe, it, expect } from 'vitest'
import { parseQuickAdd, QuickAddError } from './parse'

// テストは日付を固定して実施（2026-07-13 = 実装日）
const TODAY = { y: 2026, m: 7, d: 13 }

describe('parseQuickAdd', () => {
  it('タイトルのみ → Inbox / medium / 期日なし', () => {
    expect(parseQuickAdd('見積送付', TODAY)).toEqual({
      title: '見積送付',
      projectName: 'Inbox',
      dueDate: null,
      priority: 'medium',
    })
  })

  it('先頭 s → Sales（大文字も可）', () => {
    expect(parseQuickAdd('s 見積送付', TODAY).projectName).toBe('Sales')
    expect(parseQuickAdd('S 見積送付', TODAY).projectName).toBe('Sales')
  })

  it('先頭 p → Personal, b → Second Brain', () => {
    expect(parseQuickAdd('p 散髪予約', TODAY).projectName).toBe('Personal')
    expect(parseQuickAdd('b wiki整備', TODAY).projectName).toBe('Second Brain')
  })

  it('先頭以外の s はタイトルの一部', () => {
    const r = parseQuickAdd('資料 s 確認', TODAY)
    expect(r.projectName).toBe('Inbox')
    expect(r.title).toBe('資料 s 確認')
  })

  it('due:M/D 今日以降 → 今年', () => {
    expect(parseQuickAdd('見積 due:7/18', TODAY).dueDate).toBe('2026-07-18')
    expect(parseQuickAdd('見積 due:7/13', TODAY).dueDate).toBe('2026-07-13')
  })

  it('due:M/D 過去日 → 翌年に補完', () => {
    expect(parseQuickAdd('見積 due:7/12', TODAY).dueDate).toBe('2027-07-12')
    expect(parseQuickAdd('見積 due:1/5', TODAY).dueDate).toBe('2027-01-05')
  })

  it('due:YYYY-MM-DD は絶対指定', () => {
    expect(parseQuickAdd('見積 due:2026-12-01', TODAY).dueDate).toBe('2026-12-01')
  })

  it('due:今日 / due:明日', () => {
    expect(parseQuickAdd('見積 due:今日', TODAY).dueDate).toBe('2026-07-13')
    expect(parseQuickAdd('見積 due:明日', TODAY).dueDate).toBe('2026-07-14')
  })

  it('due:明日 は月末をまたぐ', () => {
    expect(parseQuickAdd('見積 due:明日', { y: 2026, m: 7, d: 31 }).dueDate).toBe('2026-08-01')
  })

  it('不正な due: はタイトルに残る', () => {
    const r = parseQuickAdd('見積 due:13/40', TODAY)
    expect(r.dueDate).toBeNull()
    expect(r.title).toBe('見積 due:13/40')
  })

  it('!high / !low で優先度指定・タイトルから除去', () => {
    expect(parseQuickAdd('見積 !high', TODAY).priority).toBe('high')
    expect(parseQuickAdd('見積 !low', TODAY).priority).toBe('low')
    expect(parseQuickAdd('見積 !high', TODAY).title).toBe('見積')
  })

  it('!high/!low 以外の ! トークンはタイトル扱い', () => {
    const r = parseQuickAdd('見積 !urgent', TODAY)
    expect(r.priority).toBe('medium')
    expect(r.title).toBe('見積 !urgent')
  })

  it('記法トークンのみでタイトルが空 → QuickAddError', () => {
    expect(() => parseQuickAdd('s due:7/18 !high', TODAY)).toThrow(QuickAddError)
    expect(() => parseQuickAdd('   ', TODAY)).toThrow(QuickAddError)
  })

  it('全部入り: "s 顧客A 見積送付 due:7/18 !high"', () => {
    expect(parseQuickAdd('s 顧客A 見積送付 due:7/18 !high', TODAY)).toEqual({
      title: '顧客A 見積送付',
      projectName: 'Sales',
      dueDate: '2026-07-18',
      priority: 'high',
    })
  })
})
