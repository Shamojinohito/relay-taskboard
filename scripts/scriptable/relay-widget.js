// Relay Taskboard — iPhone ホーム画面ウィジェット（Scriptable 用）
//
// セットアップ:
// 1. App Store で「Scriptable」(無料) をインストール
// 2. Scriptable で新規スクリプトを作成し、このファイルの内容を貼り付けて
//    「Relay」等の名前で保存
// 3. 下の API_KEY に relay の agent API キーを設定
//    （Web UI のエージェント管理から読み取り専用キーの発行を推奨。
//      このファイルをコミットする場合はキーを書き込んだ状態にしないこと）
// 4. ホーム画面を長押し → ウィジェット追加 → Scriptable を選択
//    （中サイズ or 大サイズ推奨）→ ウィジェットを長押し → 「編集」で
//    Script に「Relay」を指定
//
// 動作:
// - todo / in_progress / blocked / in_review のタスクを表示
// - blocked / in_review（人の対応待ち）は ⚠ 付きで上部に表示
// - 期限切れ・当日は赤、3日以内はオレンジで期日を表示
// - タップでデプロイ済みの Web UI を開く
// - JWT は Keychain にキャッシュし、期限内は再認証しない

const BASE_URL = "https://relay-taskboard.vercel.app"
const API_KEY = "" // ← relay の agent API キーを設定
const STATUSES = "todo,in_progress,blocked,in_review"
const KEYCHAIN_KEY = "relay_widget_jwt"

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

async function fetchTasks() {
  const token = await getToken()
  const req = new Request(`${BASE_URL}/api/v1/agent/board?status=${STATUSES}`)
  req.headers = { Authorization: `Bearer ${token}` }
  const res = await req.loadJSON()
  if (!res.tasks) throw new Error(res.error ?? "取得失敗")
  return res.tasks
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
  return "○"
}

function addTaskRow(widget, t) {
  const row = widget.addStack()
  row.centerAlignContent()
  row.spacing = 4

  const icon = row.addText(statusIcon(t))
  icon.font = Font.systemFont(11)

  const needsHuman = t.status === "blocked" || t.status === "in_review"
  const title = row.addText(t.title)
  title.font = needsHuman ? Font.semiboldSystemFont(12) : Font.systemFont(12)
  title.textColor = needsHuman ? COLORS.needsHuman : COLORS.text
  title.lineLimit = 1

  row.addSpacer()

  const d = daysUntil(t.due_date)
  if (d !== null) {
    const label = d < 0 ? `${-d}日超過` : d === 0 ? "今日" : d === 1 ? "明日" : `${d}日後`
    const due = row.addText(label)
    due.font = Font.mediumSystemFont(10)
    due.textColor = d <= 0 ? COLORS.overdue : d <= 3 ? COLORS.soon : COLORS.sub
  }
}

function buildWidget(tasks) {
  const widget = new ListWidget()
  widget.backgroundColor = COLORS.bg
  widget.url = BASE_URL
  widget.setPadding(14, 14, 12, 14)
  widget.refreshAfterDate = new Date(Date.now() + 15 * 60_000)

  const needsHumanCount = tasks.filter((t) => t.status === "blocked" || t.status === "in_review").length
  const overdueCount = tasks.filter((t) => { const d = daysUntil(t.due_date); return d !== null && d <= 0 }).length

  const header = widget.addStack()
  header.centerAlignContent()
  const logo = header.addText("Relay")
  logo.font = Font.boldSystemFont(14)
  logo.textColor = COLORS.accent
  header.addSpacer()
  const parts = [`${tasks.length}件`]
  if (needsHumanCount) parts.push(`要対応${needsHumanCount}`)
  if (overdueCount) parts.push(`期限超過${overdueCount}`)
  const summary = header.addText(parts.join(" / "))
  summary.font = Font.mediumSystemFont(10)
  summary.textColor = needsHumanCount || overdueCount ? COLORS.overdue : COLORS.sub

  if (config.widgetFamily === "small") {
    // 小サイズは件数サマリのみ
    widget.addSpacer()
    const big = widget.addText(String(tasks.length))
    big.font = Font.boldSystemFont(36)
    big.textColor = COLORS.text
    const sub = widget.addText(needsHumanCount ? `要対応 ${needsHumanCount}件` : "オープンタスク")
    sub.font = Font.systemFont(11)
    sub.textColor = needsHumanCount ? COLORS.needsHuman : COLORS.sub
    widget.addSpacer()
    return widget
  }

  widget.addSpacer(8)
  const maxRows = config.widgetFamily === "large" ? 9 : 4
  const sorted = sortForDisplay(tasks)
  for (const t of sorted.slice(0, maxRows)) {
    addTaskRow(widget, t)
    widget.addSpacer(4)
  }
  if (sorted.length > maxRows) {
    const more = widget.addText(`ほか ${sorted.length - maxRows} 件`)
    more.font = Font.systemFont(10)
    more.textColor = COLORS.sub
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

let widget
try {
  if (!API_KEY) throw new Error("API_KEY が未設定です。スクリプト冒頭に設定してください。")
  widget = buildWidget(await fetchTasks())
} catch (e) {
  widget = buildErrorWidget(String(e.message ?? e))
}

if (config.runsInWidget) {
  Script.setWidget(widget)
} else {
  await widget.presentMedium()
}
Script.complete()
