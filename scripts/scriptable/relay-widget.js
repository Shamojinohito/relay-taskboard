// Relay Taskboard — iPhone ホーム画面ウィジェット（Scriptable 用）
//
// セットアップ:
// 1. App Store で「Scriptable」(無料) をインストール
// 2. Scriptable で新規スクリプトを作成し、このファイルの内容を貼り付けて
//    「Relay」等の名前で保存
// 3. 下の API_KEY に relay の agent API キーを設定
//    （タスク完了操作を使うため write:tasks スコープが必要。
//      このファイルをコミットする場合はキーを書き込んだ状態にしないこと）
// 4. ホーム画面を長押し → ウィジェット追加 → Scriptable を選択
//    （中サイズ or 大サイズ推奨）→ ウィジェットを長押し → 「編集」で
//    Script に「Relay」を指定
//
// 動作:
// - todo / in_progress / blocked / in_review のタスクを表示
// - 行頭の ○ をタップ → そのタスクを done にする（Scriptable が一瞬開いて閉じる。
//   ウィジェットへの反映は次回リフレッシュ時）
// - ヘッダーの「All / Today」をタップ → 表示モード切替（Today = 期日が今日以前のみ）
//   ※ ウィジェット設定の Parameter に today / all を書くと固定できる（タップ切替より優先）
// - ヘッダーの ↻ をタップ → 再読み込み
// - フッターの「ほか N 件」をタップ → Scriptable 内でスクロール可能な全件リストを表示
//   （ウィジェット自体は iOS の仕様でスクロール不可のため）
// - blocked / in_review（人の対応待ち）は ⚠ 付きで上部に表示
// - 期限切れ・当日は赤、3日以内はオレンジで期日を表示
// - タイトル部分のタップでデプロイ済みの Web UI を開く
// - JWT は Keychain にキャッシュし、期限内は再認証しない

const BASE_URL = "https://relay-taskboard.vercel.app"
const API_KEY = "" // ← relay の agent API キーを設定
const STATUSES = "todo,in_progress,blocked,in_review"
const KEYCHAIN_KEY = "relay_widget_jwt"
const MODE_KEY = "relay_widget_mode" // "all" | "today"

function runUrl(query) {
  return `scriptable:///run/${encodeURIComponent(Script.name())}?${query}`
}

function getMode() {
  const param = (args.widgetParameter ?? "").trim().toLowerCase()
  if (param === "today" || param === "all") return param
  try {
    const stored = Keychain.contains(MODE_KEY) ? Keychain.get(MODE_KEY) : null
    if (stored === "today" || stored === "all") return stored
  } catch (e) { /* 壊れた値は無視 */ }
  return "all"
}

async function getToken() {
  if (Keychain.contains(KEYCHAIN_KEY)) {
    try {
      const cached = JSON.parse(Keychain.get(KEYCHAIN_KEY))
      if (cached.exp > Date.now() + 60_000) return cached.token
    } catch (e) { /* 壊れたキャッシュは無視して再認証 */ }
  }
  const req = new Request(`${BASE_URL}/api/v1/agent/auth`)
  req.method = "POST"
  req.headers = { "Content-Type": "application/json" }
  req.body = JSON.stringify({ api_key: API_KEY })
  const res = await req.loadJSON()
  if (!res.token) throw new Error(res.error ?? "認証失敗")
  // トークンは 24h 有効。余裕を見て 23h でキャッシュ失効させる
  Keychain.set(KEYCHAIN_KEY, JSON.stringify({ token: res.token, exp: Date.now() + 23 * 3600_000 }))
  return res.token
}

async function fetchTasks(mode) {
  const token = await getToken()
  const req = new Request(`${BASE_URL}/api/v1/agent/board?status=${STATUSES}`)
  req.headers = { Authorization: `Bearer ${token}` }
  const res = await req.loadJSON()
  if (!res.tasks) throw new Error(res.error ?? "取得失敗")
  if (mode === "today") {
    return res.tasks.filter((t) => {
      const d = daysUntil(t.due_date)
      return d !== null && d <= 0
    })
  }
  return res.tasks
}

async function markDone(taskId) {
  const token = await getToken()
  const req = new Request(`${BASE_URL}/api/v1/agent/tasks/${taskId}`)
  req.method = "PATCH"
  req.headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
  req.body = JSON.stringify({ status: "done" })
  const res = await req.loadJSON()
  if (res.error) throw new Error(res.error)
}

async function notify(title, body) {
  const n = new Notification()
  n.title = title
  if (body) n.body = body
  await n.schedule()
}

// スクロール可能な全件リスト（Scriptable アプリ内で表示。ウィジェットは仕様上スクロール不可）
async function presentTaskList(mode) {
  const tasks = sortForDisplay(await fetchTasks(mode))
  const table = new UITable()
  table.showSeparators = true

  const header = new UITableRow()
  header.isHeader = true
  header.height = 44
  header.addText(`Relay — ${mode === "today" ? "今日のタスク" : "オープンタスク"} ${tasks.length}件`)
  table.addRow(header)

  for (const t of tasks) {
    const row = new UITableRow()
    row.height = 52
    const d = daysUntil(t.due_date)
    const dueLabel = d === null ? "" : d < 0 ? `${-d}日超過` : d === 0 ? "今日" : d === 1 ? "明日" : `${d}日後`
    const icon = statusIcon(t) ?? "○"
    row.addText(`${icon} ${t.title}`, dueLabel)
    row.onSelect = () => Safari.open(BASE_URL)
    table.addRow(row)
  }

  await table.present(false)
}

// ウィジェット上のタップ操作（○ / モード切替 / ↻ / 全件リスト）はこの分岐で処理される
async function handleAction(params) {
  if (params.action === "list") {
    await presentTaskList(getMode())
    return
  }
  if (params.action === "done" && params.task) {
    try {
      await markDone(params.task)
      await notify("✓ Relay タスクを完了しました", params.title ?? "")
    } catch (e) {
      await notify("Relay 完了操作に失敗", String(e.message ?? e))
    }
    return
  }
  if (params.action === "toggleMode") {
    const next = getMode() === "today" ? "all" : "today"
    try { Keychain.set(MODE_KEY, next) } catch (e) { /* ignore */ }
    return
  }
  // action === "refresh" は何もしない（スクリプト実行自体がリフレッシュの契機になる）
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr + "T00:00:00")
  return Math.round((due - today) / 86_400_000)
}

function sortForDisplay(tasks) {
  const needsHuman = (t) => t.status === "blocked" || t.status === "in_review"
  const prio = { high: 0, medium: 1, low: 2 }
  return [...tasks].sort((a, b) => {
    if (needsHuman(a) !== needsHuman(b)) return needsHuman(a) ? -1 : 1
    const da = daysUntil(a.due_date), db = daysUntil(b.due_date)
    if (da !== db) return (da ?? 9999) - (db ?? 9999)
    return (prio[a.priority] ?? 1) - (prio[b.priority] ?? 1)
  })
}

const COLORS = {
  bg: Color.dynamic(new Color("#ffffff"), new Color("#1c1c1e")),
  text: Color.dynamic(new Color("#1c1c1e"), new Color("#f2f2f7")),
  sub: Color.dynamic(new Color("#6e6e73"), new Color("#98989e")),
  overdue: new Color("#e5484d"),
  soon: new Color("#f5a623"),
  needsHuman: new Color("#f5a623"),
  accent: new Color("#5b8def"),
}

function statusIcon(t) {
  if (t.status === "blocked") return "⚠"
  if (t.status === "in_review") return "👀"
  if (t.status === "in_progress") return "▶"
  return null
}

function addTaskRow(widget, t) {
  const row = widget.addStack()
  row.centerAlignContent()
  row.spacing = 4

  // タップで done にするチェックボックス
  const checkbox = row.addStack()
  checkbox.url = runUrl(`action=done&task=${encodeURIComponent(t.id)}&title=${encodeURIComponent(t.title)}`)
  const circle = checkbox.addText("○")
  circle.font = Font.systemFont(12)
  circle.textColor = COLORS.sub

  const needsHuman = t.status === "blocked" || t.status === "in_review"
  const icon = statusIcon(t)
  if (icon) {
    const iconText = row.addText(icon)
    iconText.font = Font.systemFont(10)
  }

  const title = row.addText(t.title)
  title.font = needsHuman ? Font.semiboldSystemFont(11) : Font.systemFont(11)
  title.textColor = needsHuman ? COLORS.needsHuman : COLORS.text
  title.lineLimit = 1
  title.url = BASE_URL

  row.addSpacer()

  const d = daysUntil(t.due_date)
  if (d !== null) {
    const label = d < 0 ? `${-d}日超過` : d === 0 ? "今日" : d === 1 ? "明日" : `${d}日後`
    const due = row.addText(label)
    due.font = Font.mediumSystemFont(9)
    due.textColor = d <= 0 ? COLORS.overdue : d <= 3 ? COLORS.soon : COLORS.sub
  }
}

function buildWidget(tasks, mode) {
  const widget = new ListWidget()
  widget.backgroundColor = COLORS.bg
  widget.url = BASE_URL
  widget.setPadding(12, 12, 10, 12)
  widget.refreshAfterDate = new Date(Date.now() + 15 * 60_000)

  const needsHumanCount = tasks.filter((t) => t.status === "blocked" || t.status === "in_review").length
  const overdueCount = tasks.filter((t) => { const d = daysUntil(t.due_date); return d !== null && d <= 0 }).length

  const header = widget.addStack()
  header.centerAlignContent()
  header.spacing = 6
  const logo = header.addText("Relay")
  logo.font = Font.boldSystemFont(14)
  logo.textColor = COLORS.accent

  // モード切替（タップで All ⇄ Today）
  const modeStack = header.addStack()
  modeStack.url = runUrl("action=toggleMode")
  const modeLabel = modeStack.addText(mode === "today" ? "Today" : "All")
  modeLabel.font = Font.mediumSystemFont(10)
  modeLabel.textColor = mode === "today" ? COLORS.accent : COLORS.sub

  header.addSpacer()
  const parts = [`${tasks.length}件`]
  if (needsHumanCount) parts.push(`要対応${needsHumanCount}`)
  if (overdueCount) parts.push(`期限超過${overdueCount}`)
  const summary = header.addText(parts.join(" / "))
  summary.font = Font.mediumSystemFont(10)
  summary.textColor = needsHumanCount || overdueCount ? COLORS.overdue : COLORS.sub

  // リロード
  const reloadStack = header.addStack()
  reloadStack.url = runUrl("action=refresh")
  const reload = reloadStack.addText("↻")
  reload.font = Font.mediumSystemFont(12)
  reload.textColor = COLORS.sub

  if (config.widgetFamily === "small") {
    // 小サイズは件数サマリのみ
    widget.addSpacer()
    const big = widget.addText(String(tasks.length))
    big.font = Font.boldSystemFont(36)
    big.textColor = COLORS.text
    const sub = widget.addText(needsHumanCount ? `要対応 ${needsHumanCount}件` : mode === "today" ? "今日のタスク" : "オープンタスク")
    sub.font = Font.systemFont(11)
    sub.textColor = needsHumanCount ? COLORS.needsHuman : COLORS.sub
    widget.addSpacer()
    return widget
  }

  widget.addSpacer(6)
  const maxRows = config.widgetFamily === "large" ? 12 : 6
  const sorted = sortForDisplay(tasks)
  if (sorted.length === 0) {
    const empty = widget.addText(mode === "today" ? "今日のタスクはありません 🎉" : "オープンタスクはありません 🎉")
    empty.font = Font.systemFont(12)
    empty.textColor = COLORS.sub
  }
  for (const t of sorted.slice(0, maxRows)) {
    addTaskRow(widget, t)
    widget.addSpacer(3)
  }
  if (sorted.length > maxRows) {
    // ウィジェットはスクロール不可のため、溢れた分はタップでアプリ内の全件リストへ
    const moreStack = widget.addStack()
    moreStack.url = runUrl("action=list")
    const more = moreStack.addText(`ほか ${sorted.length - maxRows} 件 ▸ タップで全件表示`)
    more.font = Font.mediumSystemFont(10)
    more.textColor = COLORS.accent
  }
  widget.addSpacer()
  return widget
}

function buildErrorWidget(message) {
  const widget = new ListWidget()
  widget.backgroundColor = COLORS.bg
  widget.url = BASE_URL
  const title = widget.addText("Relay — エラー")
  title.font = Font.boldSystemFont(13)
  title.textColor = COLORS.overdue
  widget.addSpacer(6)
  const body = widget.addText(message)
  body.font = Font.systemFont(11)
  body.textColor = COLORS.sub
  widget.refreshAfterDate = new Date(Date.now() + 15 * 60_000)
  return widget
}

const params = args.queryParameters ?? {}

if (!config.runsInWidget && params.action) {
  // ウィジェットのタップ操作から起動されたケース
  try {
    if (!API_KEY) throw new Error("API_KEY が未設定です")
    await handleAction(params)
  } catch (e) {
    await notify("Relay ウィジェットエラー", String(e.message ?? e))
  }
  App.close()
} else {
  const mode = getMode()
  let widget
  try {
    if (!API_KEY) throw new Error("API_KEY が未設定です。スクリプト冒頭に設定してください。")
    widget = buildWidget(await fetchTasks(mode), mode)
  } catch (e) {
    widget = buildErrorWidget(String(e.message ?? e))
  }

  if (config.runsInWidget) {
    Script.setWidget(widget)
  } else {
    await widget.presentMedium()
  }
}
Script.complete()
