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
