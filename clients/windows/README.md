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
