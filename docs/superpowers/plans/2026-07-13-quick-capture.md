# Quick Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Windows(AutoHotkey) / Mac(Raycast) / iPhone(ショートカット) から1行テキストで relay-taskboard にタスクを即時登録できるようにする。

**Architecture:** relay 本体に `POST /api/v1/agent/quick-add`（APIキー直接認証・サーバー側パース）を新設し、記法解釈を `lib/quick-add/parse.ts` の純関数に一元化。無指定タスクは新設の Inbox プロジェクトへ。3クライアントは「テキスト1本を1リクエストPOST → レスポンスの `summary` を通知表示」のみの極小実装。

**Tech Stack:** Next.js (App Router) / Supabase / vitest（新規導入・パーサー単体テストのみ）/ AutoHotkey v2 / bash (Raycast Script Command) / iOS ショートカット

**Spec:** `docs/superpowers/specs/2026-07-13-quick-capture-design.md`

**作業ディレクトリ:** `C:/Users/DN31110/Project/relay-taskboard`（すべてのパスはリポジトリルート相対）

---

## 前提知識（このリポジトリの流儀）

- Agent API のルートは `app/api/agent/<name>/route.ts` に実体を書き、`app/api/v1/agent/<name>/route.ts` は `export { POST } from '@/app/api/agent/<name>/route'` の再エクスポートのみ（例: `app/api/v1/agent/tasks/route.ts`）
- ミドルウェア（`middleware.ts:27`）は `/api/agent` と `/api/v1/agent` をセッション認証スキップ済み。ルート追加だけで疎通する
- APIキー検証は `lib/agents/auth.ts` の `validateAgentApiKey(apiKey)`（SHA-256照合、`{ id, name, type, project_ids, scopes }` か null を返す）
- 監査ログは `lib/agents/api.ts` の `writeAgentAuditLog({...})`
- DB書き込みは `createServiceClient()`（`lib/supabase/service.ts`）+ `(supabase.from('tasks') as any)` パターン
- `tasks` スキーマ: `priority IN ('low','medium','high','urgent')`, `status IN ('backlog','todo',...)`, `due_date DATE`
- パスエイリアス: `@/*` → リポジトリルート
- テスト基盤なし → vitest を今回導入（`*.test.ts` はゼロコンフィグで動く）
- ローカルに `.env.local` がないため、エンドポイントの動作確認は Vercel デプロイ後に本番 URL への curl で行う

---

### Task 1: vitest 導入

**Files:**
- Modify: `package.json`（scripts に test 追加・devDependencies に vitest）

- [ ] **Step 1: vitest をインストール**

```bash
cd C:/Users/DN31110/Project/relay-taskboard
npm install -D vitest
```

- [ ] **Step 2: package.json の scripts に test を追加**

`package.json` の scripts を以下にする（既存4行に `"test"` を追加）:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run"
  },
```

- [ ] **Step 3: 動作確認**

Run: `npm test`
Expected: `No test files found` で終了（exit code 1 だが vitest が起動することを確認できれば OK）

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add vitest for unit testing"
```

---

### Task 2: パーサー `parseQuickAdd`（TDD）

**Files:**
- Create: `lib/quick-add/parse.ts`
- Test: `lib/quick-add/parse.test.ts`

**パース仕様（spec §4 の確定版）:**
- 先頭トークン `s`/`p`/`b`（大文字小文字不問）→ Sales / Personal / Second Brain。なければ Inbox。先頭以外の位置ではタイトル扱い
- `due:` トークン（位置不問・複数あれば最後が有効）: `M/D`（過去日は翌年補完）・`YYYY-MM-DD`・`今日`・`明日`。解釈できない `due:` トークンはタイトルに残す（黙って捨てない）
- `!high` / `!low`（位置不問・複数あれば最後が有効）。それ以外の `!` トークンはタイトル扱い
- 記法を除いた残りを空白1つで連結してタイトル。タイトルが空になったら `QuickAddError`
- 期日の「今日」はサーバーがUTCで動くため **JST基準**で計算する（`jstToday()`）

- [ ] **Step 1: 失敗するテストを書く**

`lib/quick-add/parse.test.ts` を作成:

```ts
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
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL — `Cannot find module './parse'` 相当のエラー

- [ ] **Step 3: 実装を書く**

`lib/quick-add/parse.ts` を作成:

```ts
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: PASS — 14 tests passed

- [ ] **Step 5: Commit**

```bash
git add lib/quick-add/parse.ts lib/quick-add/parse.test.ts
git commit -m "feat: add quick-add text parser (project/due/priority tokens)"
```

---

### Task 3: `POST /api/v1/agent/quick-add` エンドポイント

**Files:**
- Create: `app/api/agent/quick-add/route.ts`
- Create: `app/api/v1/agent/quick-add/route.ts`

エンドポイントの単体テストは書かない（Supabase 依存・spec §5 のとおり curl で確認）。パースロジックは Task 2 でテスト済み。

- [ ] **Step 1: 実体ルートを作成**

`app/api/agent/quick-add/route.ts` を作成:

```ts
// app/api/agent/quick-add/route.ts
// クイックキャプチャ用エンドポイント。X-Api-Key でAPIキーを直接受け（JWT交換不要）、
// テキスト1本をパースしてタスクを作成する。
// 仕様: docs/superpowers/specs/2026-07-13-quick-capture-design.md
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validateAgentApiKey } from '@/lib/agents/auth'
import { writeAgentAuditLog } from '@/lib/agents/api'
import { parseQuickAdd, jstToday, QuickAddError } from '@/lib/quick-add/parse'

export async function POST(request: Request) {
  const apiKey = request.headers.get('X-Api-Key')
  if (!apiKey) return NextResponse.json({ error: 'X-Api-Key header required' }, { status: 401 })

  const agent = await validateAgentApiKey(apiKey)
  if (!agent || !agent.scopes?.includes('write:tasks')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (typeof body?.text !== 'string' || !body.text.trim()) {
    return NextResponse.json({ error: 'text required' }, { status: 400 })
  }

  let parsed
  try {
    parsed = parseQuickAdd(body.text, jstToday())
  } catch (e) {
    if (e instanceof QuickAddError) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    throw e
  }

  const supabase = createServiceClient()

  const { data: project, error: projectError } = await (supabase.from('projects') as any)
    .select('id, name')
    .eq('name', parsed.projectName)
    .is('archived_at', null)
    .single()
  if (projectError || !project) {
    return NextResponse.json(
      { error: `${parsed.projectName} project not found` },
      { status: 500 }
    )
  }

  const { data: task, error } = await (supabase.from('tasks') as any)
    .insert({
      project_id: project.id,
      title: parsed.title,
      status: 'todo',
      priority: parsed.priority,
      action_type: 'other',
      due_date: parsed.dueDate,
      created_by_agent_id: agent.id,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAgentAuditLog({
    action: 'tasks.quick_add',
    agentId: agent.id,
    metadata: { source: body.source ?? null, text: body.text },
    requestId: request.headers.get('X-Request-Id'),
    taskId: task.id,
  })

  // クライアントが通知にそのまま使える1行サマリー
  const extras = [
    parsed.dueDate ? `due ${parsed.dueDate}` : null,
    parsed.priority !== 'medium' ? parsed.priority : null,
  ].filter(Boolean)
  const summary =
    `${parsed.projectName}: ${parsed.title}` + (extras.length ? ` (${extras.join(', ')})` : '')

  return NextResponse.json({ task, parsed, summary }, { status: 201 })
}
```

- [ ] **Step 2: v1 再エクスポートを作成**

`app/api/v1/agent/quick-add/route.ts` を作成:

```ts
export { POST } from '@/app/api/agent/quick-add/route'
```

- [ ] **Step 3: lint と build を通す**

Run: `npm run lint && npm run build`
Expected: エラーなし（warning は既存分のみ許容）

- [ ] **Step 4: Commit**

```bash
git add app/api/agent/quick-add/route.ts app/api/v1/agent/quick-add/route.ts
git commit -m "feat: add quick-add endpoint (X-Api-Key auth, server-side parsing)"
```

---

### Task 4: プロジェクト一覧で Inbox を先頭にピン留め

**Files:**
- Modify: `hooks/use-projects.ts:15-16`

サイドバー含む全プロジェクト一覧がこのフックを使う。JSの `sort` は安定ソートなので、Inbox 以外の相対順（created_at 昇順）は保たれる。

- [ ] **Step 1: queryFn の return を変更**

`hooks/use-projects.ts` の

```ts
      if (error) throw error
      return data
```

を以下に変更:

```ts
      if (error) throw error
      // Inbox（クイックキャプチャの受け皿）は常に先頭に表示する（名前ベースのピン留め）
      return (data ?? []).sort(
        (a: any, b: any) => (a.name === 'Inbox' ? 0 : 1) - (b.name === 'Inbox' ? 0 : 1)
      )
```

- [ ] **Step 2: lint と build を通す**

Run: `npm run lint && npm run build`
Expected: エラーなし

- [ ] **Step 3: Commit**

```bash
git add hooks/use-projects.ts
git commit -m "feat: pin Inbox project to top of project lists"
```

---

### Task 5: デプロイ

- [ ] **Step 1: push（Vercel の GitHub 連携で自動デプロイ）**

```bash
git push origin main
```

- [ ] **Step 2: デプロイ完了を確認**

2〜3分待って既存エンドポイントの疎通を確認:

Run: `curl -s -o /dev/null -w "%{http_code}" -X POST https://relay-taskboard.vercel.app/api/v1/agent/quick-add -H "Content-Type: application/json" -d '{"text":"x"}'`
Expected: `401`（X-Api-Key なし → 新ルートがデプロイされている証拠。`404` なら未デプロイ）

---

### Task 6: 人間ステップ + 本番疎通確認 【ユーザー操作が必要】

- [ ] **Step 1: Inbox プロジェクト作成（ユーザー）**

https://relay-taskboard.vercel.app → Projects → New Project → 名前 `Inbox`（説明: クイックキャプチャの受け皿）

- [ ] **Step 2: quick-capture エージェント作成（ユーザー）**

Agents 画面 → New Agent → name `quick-capture` / type `custom` → 表示された `sk-agent-...` キーを控える（**この画面でしか表示されない**）

- [ ] **Step 3: scope を最小化（ユーザー・推奨）**

Supabase ダッシュボード → SQL Editor:

```sql
UPDATE agents SET scopes = ARRAY['write:tasks'] WHERE name = 'quick-capture';
```

（UIで作ると全scopeが付くため。省略しても動くが、キー漏洩時の影響がタスク作成以外に広がる）

- [ ] **Step 4: 本番疎通確認（キーを受け取って実施）**

```bash
KEY="sk-agent-..."
# 1) Inbox行き
curl -s -X POST https://relay-taskboard.vercel.app/api/v1/agent/quick-add \
  -H "Content-Type: application/json" -H "X-Api-Key: $KEY" \
  -d '{"text":"疎通テスト due:明日 !low","source":"curl-test"}'
# Expected: 201, summary "Inbox: 疎通テスト (due <明日の日付>, low)"

# 2) Sales行き
curl -s -X POST https://relay-taskboard.vercel.app/api/v1/agent/quick-add \
  -H "Content-Type: application/json" -H "X-Api-Key: $KEY" \
  -d '{"text":"s 疎通テスト2","source":"curl-test"}'
# Expected: 201, summary "Sales: 疎通テスト2"

# 3) 不正キー
curl -s -o /dev/null -w "%{http_code}" -X POST https://relay-taskboard.vercel.app/api/v1/agent/quick-add \
  -H "Content-Type: application/json" -H "X-Api-Key: sk-agent-invalid" -d '{"text":"x"}'
# Expected: 401
```

- [ ] **Step 5: ボードで確認**

Web UI で Inbox が**サイドバー先頭**に表示され、疎通テストタスクが入っていること。確認後テストタスクは削除してよい。

---

### Task 7: Windows クライアント（AutoHotkey v2）

**Files:**
- Create: `clients/windows/relay-quick-add.ahk`
- Create: `clients/windows/config.ini.example`
- Create: `clients/windows/README.md`
- Modify: `.gitignore`（`clients/windows/config.ini` を追加）

- [ ] **Step 1: AHK スクリプトを作成**

`clients/windows/relay-quick-add.ahk` を作成（文字コード **UTF-8 with BOM** で保存すること。AHK v2 は BOM なし UTF-8 だと日本語が化ける場合がある）:

```autohotkey
#Requires AutoHotkey v2.0
#SingleInstance Force

; ===================== 設定 =====================
HOTKEY_COMBO := "^!Space"  ; Ctrl+Alt+Space（変更はここ）
BASE_URL := "https://relay-taskboard.vercel.app"
CONFIG_PATH := A_ScriptDir "\config.ini"
; ================================================

API_KEY := IniRead(CONFIG_PATH, "relay", "api_key", "")
if (API_KEY = "") {
    MsgBox("config.ini の [relay] api_key が未設定です。`nconfig.ini.example をコピーして設定してください。", "Relay Quick Add", "Iconx")
    ExitApp()
}

TraySetIcon("shell32.dll", 265)  ; チェックマーク風アイコン
A_IconTip := "Relay Quick Add (" HOTKEY_COMBO ")"
Hotkey(HOTKEY_COMBO, (*) => ShowBox(""))

ShowBox(prefill) {
    static qaGui := 0
    if IsObject(qaGui) {
        try qaGui.Destroy()
    }
    qaGui := Gui("+AlwaysOnTop -Caption +ToolWindow +Border", "Relay Quick Add")
    qaGui.SetFont("s9 cGray", "Yu Gothic UI")
    qaGui.MarginX := 14
    qaGui.MarginY := 10
    qaGui.AddText(, "Relay に追加 ｜ s=Sales p=Personal b=SecondBrain ｜ due:7/18・due:明日 ｜ !high !low ｜ Esc=閉じる")
    qaGui.SetFont("s12 cDefault", "Yu Gothic UI")
    edit := qaGui.AddEdit("w600 -WantReturn", prefill)
    okBtn := qaGui.AddButton("Default Hidden", "OK")  ; Enter で発火する隠しボタン
    okBtn.OnEvent("Click", (*) => Submit(qaGui, edit.Value))
    qaGui.OnEvent("Escape", (*) => qaGui.Destroy())
    qaGui.Show("AutoSize xCenter y160")
}

Submit(qaGui, text) {
    text := Trim(text)
    qaGui.Destroy()
    if (text = "")
        return
    try {
        req := ComObject("WinHttp.WinHttpRequest.5.1")
        req.Open("POST", BASE_URL "/api/v1/agent/quick-add", false)
        ; charset=utf-8 指定により WinHttp が UTF-16 文字列を UTF-8 で送信する
        req.SetRequestHeader("Content-Type", "application/json; charset=utf-8")
        req.SetRequestHeader("X-Api-Key", API_KEY)
        req.Send('{"text":' JsonStr(text) ',"source":"windows-ahk"}')
        if (req.Status = 201) {
            TrayTip(ExtractSummary(req.ResponseText), "✓ Relay に追加しました", "Iconi Mute")
        } else {
            TrayTip("HTTP " req.Status " — テキストを保持して再表示します", "Relay 送信失敗", "Iconx")
            ShowBox(text)  ; 入力を消失させない
        }
    } catch as e {
        TrayTip(e.Message " — テキストを保持して再表示します", "Relay 送信エラー", "Iconx")
        ShowBox(text)
    }
}

JsonStr(s) {
    s := StrReplace(s, "\", "\\")
    s := StrReplace(s, '"', '\"')
    s := StrReplace(s, "`r", "\r")
    s := StrReplace(s, "`n", "\n")
    s := StrReplace(s, "`t", "\t")
    return '"' s '"'
}

ExtractSummary(json) {
    ; 通知表示用に summary フィールドだけ取り出す（厳密な JSON パースはしない）
    if RegExMatch(json, '"summary":"([^"]*)"', &m)
        return m[1]
    return "登録完了"
}
```

- [ ] **Step 2: config.ini.example を作成**

`clients/windows/config.ini.example`:

```ini
; config.ini にコピーして api_key を設定する（config.ini は git 管理外）
[relay]
api_key=sk-agent-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

- [ ] **Step 3: .gitignore に追記**

`.gitignore` の末尾に追加:

```
# quick capture client secrets
clients/windows/config.ini
```

- [ ] **Step 4: README を作成**

`clients/windows/README.md`:

```markdown
# Relay Quick Add — Windows (AutoHotkey v2)

ホットキー（既定 `Ctrl+Alt+Space`）で入力ボックスを開き、1行でタスクを relay に登録する。

## セットアップ

1. AutoHotkey v2 をインストール: `winget install AutoHotkey.AutoHotkey`
   （winget が使えない場合は https://www.autohotkey.com/ からインストーラを取得）
2. このフォルダの `config.ini.example` を `config.ini` にコピーし、`api_key` に
   relay の Agents 画面で発行した quick-capture エージェントのキーを設定
3. `relay-quick-add.ahk` をダブルクリックで起動（タスクトレイに常駐）
4. 自動起動: `Win+R` → `shell:startup` → 開いたフォルダに `relay-quick-add.ahk` の
   ショートカットを置く

## 記法

| 入力例 | 結果 |
|--------|------|
| `見積送付` | Inbox / medium |
| `s 顧客A 見積送付 due:7/18 !high` | Sales / 期日 7/18 / high |
| `p 散髪予約 due:明日` | Personal / 期日 明日 |
| `b wiki整備 !low` | Second Brain / low |

## トラブルシューティング

- 送信失敗時は通知が出て、入力テキストを保持したままボックスが再表示される
- ホットキーを変えたいときは `relay-quick-add.ahk` 冒頭の `HOTKEY_COMBO` を編集
  （記法は AutoHotkey v2: `^`=Ctrl, `!`=Alt, `+`=Shift, `#`=Win）
```

- [ ] **Step 5: 動作確認（この場で実施可能）**

1. AutoHotkey v2 がインストール済みか確認: `winget list AutoHotkey` または `ls "C:/Program Files/AutoHotkey"`
2. `config.ini` を作成し実キーを設定（Task 6 で受領したキー）
3. スクリプト起動 → `Ctrl+Alt+Space` → `テスト windows due:明日` → Enter
4. トレイ通知「✓ Relay に追加しました / Inbox: テスト windows (due ...)」が出ること
5. ボードの Inbox にタスクが入っていること（確認後削除可）
6. ネットワーク断/不正キーの失敗系: config.ini のキーを一時的に壊して送信 → エラー通知 + テキスト保持で再表示されること

- [ ] **Step 6: Commit**

```bash
git add clients/windows/ .gitignore
git commit -m "feat: add Windows quick-add client (AutoHotkey v2)"
```

---

### Task 8: Mac クライアント（Raycast Script Command）

**Files:**
- Create: `clients/mac/relay-quick-add.sh`
- Create: `clients/mac/README.md`

- [ ] **Step 1: スクリプトを作成**

`clients/mac/relay-quick-add.sh`:

```bash
#!/bin/bash
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Relay Quick Add
# @raycast.mode compact
# @raycast.packageName Relay
# @raycast.icon ✅
# @raycast.argument1 { "type": "text", "placeholder": "s タイトル due:7/18 !high" }

set -euo pipefail

BASE_URL="https://relay-taskboard.vercel.app"
KEY_FILE="$HOME/.config/relay/api_key"

if [[ ! -f "$KEY_FILE" ]]; then
  echo "APIキー未設定: $KEY_FILE を作成してください"
  exit 1
fi
API_KEY="$(tr -d '[:space:]' < "$KEY_FILE")"

payload="$(python3 -c 'import json,sys; print(json.dumps({"text": sys.argv[1], "source": "mac-raycast"}, ensure_ascii=False))' "$1")"

response="$(curl -sS --max-time 10 -X POST "$BASE_URL/api/v1/agent/quick-add" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $API_KEY" \
  --data "$payload")"

# 成功なら summary、失敗なら error を1行表示（compact モードの結果行に出る）
python3 -c 'import json,sys; d=json.loads(sys.argv[1]); print(d.get("summary") or ("エラー: " + str(d.get("error"))))' "$response"
```

- [ ] **Step 2: README を作成**

`clients/mac/README.md`:

```markdown
# Relay Quick Add — Mac (Raycast)

## セットアップ

1. APIキーを配置:
   ```sh
   mkdir -p ~/.config/relay
   echo 'sk-agent-...' > ~/.config/relay/api_key
   chmod 600 ~/.config/relay/api_key
   ```
2. このフォルダ（clients/mac）を Raycast に登録:
   Raycast → Settings → Extensions → Script Commands → Add Directories
   （リポジトリを Mac に clone するか、このファイル1本をコピーして
   `chmod +x relay-quick-add.sh` で実行権限を付ける）
3. Raycast で「Relay Quick Add」にエイリアス（例: `task`）やホットキーを割当

## 使い方

Raycast を開いて `task s 顧客A 見積送付 due:7/18 !high` → Enter。
結果行に「Sales: 顧客A 見積送付 (due 2026-07-18, high)」と表示されれば成功。

記法は Windows/iPhone と共通（サーバー側でパースするため挙動は完全一致）:
先頭 `s`/`p`/`b` = Sales/Personal/Second Brain（無指定は Inbox）、
`due:7/18`・`due:2026-07-18`・`due:今日`・`due:明日`、`!high`・`!low`
```

- [ ] **Step 3: Commit**

```bash
git add clients/mac/
git commit -m "feat: add Mac quick-add client (Raycast script command)"
```

Mac 実機での動作確認はユーザーに依頼（このマシンは Windows）。

---

### Task 9: iPhone ショートカット手順書

**Files:**
- Create: `clients/ios/README.md`

- [ ] **Step 1: 手順書を作成**

`clients/ios/README.md`:

```markdown
# Relay Quick Add — iPhone（ショートカット）

ショートカットアプリで以下の4アクションを順に追加する。

## 作成手順

新規ショートカット「Relay Quick Add」を作成し、アクションを上から順に追加:

1. **「入力を要求」**
   - 質問: `タスクを入力（s/p/b・due:7/18・!high）`
   - 入力の種類: テキスト

2. **「辞書」**
   - `text`（テキスト）: 変数「指定入力」
   - `source`（テキスト）: `ios-shortcut`

3. **「URLの内容を取得」**
   - URL: `https://relay-taskboard.vercel.app/api/v1/agent/quick-add`
   - 方法: POST
   - ヘッダ: `X-Api-Key` = `sk-agent-...`（quick-capture のキー）
   - 本文を要求: JSON → 変数「辞書」
     （「本文を要求: JSON」を選ぶと Content-Type は自動で application/json になる）

4. **「通知を表示」**
   - タイトル: `Relay に追加`
   - 本文: 変数「URLの内容」→「辞書の値を取得」で `summary` キーを指定
     （エラー時は summary が空になるので、うまくいかない場合は「URLの内容」を
     そのまま本文にすると原因が見える）

## 起動を速くする（推奨・いずれか）

- **ホーム画面に追加**: ショートカット詳細 → 共有 → ホーム画面に追加
- **アクションボタン**（iPhone 15 Pro 以降）: 設定 → アクションボタン → ショートカット
- **背面タップ**: 設定 → アクセシビリティ → タッチ → 背面タップ → ダブルタップに割当
- **共有シート**: ショートカット詳細 → 「共有シートに表示」ON、
  受け取る種類をテキストに（Safari 等で選択したテキストをそのままタスク化できる）

## 記法（Windows/Mac と共通）

| 入力例 | 結果 |
|--------|------|
| `見積送付` | Inbox / medium |
| `s 顧客A 見積送付 due:7/18 !high` | Sales / 期日 7/18 / high |
| `p 散髪予約 due:明日` | Personal / 期日 明日 |

## 注意

- APIキーはショートカット内に直接埋め込む。iPhone を紛失した場合などは
  relay の Agents 画面から quick-capture エージェントを削除すればキーが無効になる
```

- [ ] **Step 2: Commit + push**

```bash
git add clients/ios/
git commit -m "docs: add iPhone shortcut setup guide for quick-add"
git push origin main
```

iPhone 実機での作成・動作確認はユーザーに依頼。

---

### Task 10: 記録

- [ ] **Step 1: vault の wiki/log.md に記録**

`C:/Users/DN31110/Documents/ks_second_brain/wiki/log.md` の末尾に、`tools/templates.md §7` の書式に従い、quick-capture 実装の完了を1件記録する（種別は開発作業のため query/ingest に該当しない場合は自由記述で簡潔に: 実装した内容・relay リポジトリのコミット範囲・クライアント3種の場所）。

- [ ] **Step 2: relay にタスク記録（任意）**

ユーザーが relay 上で進捗管理したい場合のみ、Second Brain プロジェクトに done タスクとして記録（handoff_note にサマリー）。不要ならスキップ。

---

## 実施順序と依存関係

```
Task 1 (vitest) → Task 2 (parser) → Task 3 (endpoint) → Task 5 (deploy)
Task 4 (Inbox pin) はTask 3と独立・Task 5 より前ならいつでも
Task 6 (人間ステップ) は Task 5 の後【ユーザー操作】
Task 7 (Windows) は Task 6 の後（実キーが必要）
Task 8 (Mac) / Task 9 (iOS) は Task 6 の後ならいつでも（ドキュメント作成自体は先行可）
Task 10 (記録) は最後
```

## ユーザーにお願いする操作（まとめ)

1. Task 6: Inbox プロジェクト作成・quick-capture エージェント作成・APIキー共有・（推奨）scope 最小化 SQL
2. Task 7 Step 5: Windows での最終動作確認の立ち会い（ホットキー押下）
3. Task 8/9: Mac・iPhone でのセットアップと動作確認
