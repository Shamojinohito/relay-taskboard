# Quick Capture 設計 — Windows / iPhone / Mac からの即時タスク登録

日付: 2026-07-13
ステータス: 承認済み（実装計画へ）

## 目的

relay-taskboard へのタスク登録を、作業を中断せず数秒で完了できるようにする。
対象プラットフォームと入口:

- **Windows（会社PC・Launcherアプリ不可）**: AutoHotkey v2 常駐スクリプト。グローバルホットキーで TickTick 風の小型入力ボックスを表示
- **Mac**: Raycast Script Command
- **iPhone**: ショートカット（共有シート / ホーム画面 / アクションボタン起動）

## 成功基準

- どの端末でも「起動 → 1行入力 → 送信」が5秒以内に完了する
- 記法（プロジェクト / 期日 / 優先度）の解釈が3端末で完全に一致する
- 送信失敗時に入力テキストが消失しない
- クイック登録由来のタスクが監査ログで識別できる

## アーキテクチャ（アプローチB: サーバー側パース）

パーサーを relay 本体に一元化し、クライアントは「テキスト1本を1リクエストでPOST」するだけの極小実装とする。

```
[AHK v2]     [Raycast sh]   [iOSショートカット]
    \             |              /
     POST /api/v1/agent/quick-add  (X-Api-Key 認証・1リクエスト)
                  |
        lib/quick-add/parse.ts（純関数・単体テスト対象）
                  |
        tasks INSERT（無指定は Inbox プロジェクト）
```

却下した代替案:
- **A. クライアント直叩き**: 既存 auth→tasks API を2連POST。パースを3言語で重複実装することになり、挙動差異が出やすいため却下
- **C. タイトルのみ最小構成**: 1行完結記法の要件を満たさないため却下
- **tasks.project_id を nullable にする真のインボックス**: スキーマ・UI・RLSに波及するため却下。Inbox プロジェクトで代替

## Relay 側の変更

### 1. Inbox プロジェクト（Web UIで作成 + 表示順の小改修）

- 無指定タスクの受け皿となるプロジェクト。名前は `Inbox`
- 未アサインで登録されるため、既存トリアージビュー（/inbox）に "Unassigned" として自動浮上し、朝礼・dispatcher の振り分け対象になる
- **表示順**: プロジェクト一覧は全箇所 `created_at` 昇順のため、後から作る Inbox は最下位になってしまう。`hooks/use-projects.ts` のクエリ結果に「name が `Inbox` のプロジェクトを常に先頭へピン留め」するソートを追加する（承認済み 2026-07-13。名前ベースのピン留めであることをコード内コメントに明記）

### 2. quick-capture エージェント（agents 管理画面で作成）

- scope: `write:tasks` のみ（最小権限）
- APIキー1本を3端末で共有。監査ログ上 `quick-capture` として識別される

### 3. 新エンドポイント `POST /api/v1/agent/quick-add`

- **認証**: `X-Api-Key: <api_key>` ヘッダーで APIキーを直接受ける（`validateAgentApiKey()` を利用、JWT交換不要）。scope `write:tasks` 必須
- **リクエスト**: `{ "text": "s 見積送付 due:7/18 !high", "source": "windows-ahk" | "mac-raycast" | "ios-shortcut" }`（source は任意・監査メタデータ用）
- **レスポンス**: `201 { task, parsed: { project, due_date, priority, title } }`。クライアントの確認通知に使う
- **エラー**: text 空 → 400 / APIキー不正 → 401 / Inbox プロジェクト不存在 → 500 に "Inbox project not found"（明示メッセージ）
- 既存 `writeAgentAuditLog` で `tasks.quick_add` として記録（metadata に source を含める）

### 4. パース仕様（`lib/quick-add/parse.ts`・純関数）

| 記法 | 意味 | 例 |
|------|------|-----|
| 先頭トークン `s` / `p` / `b`（大文字小文字不問・独立トークンのみ） | Sales / Personal / Second Brain | `s 見積送付` |
| 先頭トークンなし | Inbox 行き | `見積送付` |
| `due:M/D` | 期日（過去日になる場合は翌年に補完） | `due:7/18` |
| `due:YYYY-MM-DD` | 期日（絶対指定） | `due:2026-07-18` |
| `due:今日` / `due:明日` | 期日（相対指定） | `due:明日` |
| `!high` / `!low` | 優先度（無指定は medium） | `!high` |

- due / 優先度トークンはタイトル中のどの位置でも可。除去した残りがタイトル
- タイトルが空になる入力（記法トークンのみ）は 400
- プロジェクト名 → ID の解決はサーバー側で名前一致（Sales / Personal / Second Brain / Inbox）
- タスクのその他フィールド: `status: todo`, `action_type: other`, `created_by_agent_id: quick-capture`

### 5. テスト

- vitest を devDependency として最小構成で導入（本リポジトリ初のテスト基盤）
- 対象は `lib/quick-add/parse.ts` の単体テストのみ。エンドポイント自体は curl で手動確認

## クライアント 3 種（本リポジトリ `clients/` に格納）

### Windows: `clients/windows/relay-quick-add.ahk`（AutoHotkey v2）

- グローバルホットキー（初期値 `Ctrl+Alt+Space`、スクリプト冒頭の変数で変更可）
- 画面中央上部にボーダーレスの小型入力ボックス。Enter 送信 / Esc 閉じる
- 送信成功: トレイ通知「✓ Sales: 見積送付 (7/18)」（parsed の内容を表示）
- 送信失敗: エラー通知 + 入力ボックスをテキスト保持のまま再表示（消失防止）
- APIキーは同階層 `config.ini` から読む（`.gitignore` 対象。`config.ini.example` を同梱)
- HTTP は WinHttpRequest COM を使用（追加ランタイム不要）
- 常駐はスタートアップフォルダへのショートカット登録（手順を README に記載）

### Mac: `clients/mac/relay-quick-add.sh`（Raycast Script Command）

- 引数1つ（テキスト全体）の Script Command。curl 1発
- 成功時は parsed 内容を Raycast 上に表示（mode: compact）
- APIキーは `~/.config/relay/api_key` から読む
- Raycast でエイリアス（例: `task`）・ホットキー割当可能

### iPhone: `clients/ios/README.md`（ショートカット作成手順書）

- 「入力を要求」→「URLの内容を取得（POST・ヘッダー X-Api-Key）」→「通知を表示」の3アクション
- 共有シート / ホーム画面 / アクションボタン / 背面タップからの起動設定手順を記載
- ショートカット本体は iPhone 上で手動作成（手順書はコピペ可能な粒度で書く）

## セキュリティ

- APIキーはリポジトリにコミットしない（config.ini / ~/.config/relay は .gitignore・手元管理）
- quick-capture エージェントの scope は `write:tasks` のみ。漏洩時の影響はタスク作成に限定され、キーは agents 画面から無効化可能

## 作業順序

1. Relay: パーサー（TDD）→ エンドポイント → Vercel デプロイ
2. Relay UI: Inbox プロジェクト・quick-capture エージェント作成（**人間の操作**: APIキー発行）
3. Windows AHK クライアント → この場で動作確認
4. Mac Raycast スクリプト・iOS 手順書作成（実機確認はユーザー）

## 未解決事項

なし（設計承認済み 2026-07-13）
