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
