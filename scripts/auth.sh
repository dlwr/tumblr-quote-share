#!/usr/bin/env bash
set -euo pipefail

read -r -p "Tumblr OAuth consumer key (client_id): " CLIENT_ID
read -r -s -p "Tumblr OAuth consumer secret (client_secret): " CLIENT_SECRET
echo
STATE="$(date +%s)"

cat <<MSG

ブラウザで開いて許可してください:
https://www.tumblr.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&scope=basic%20write%20offline_access&state=${STATE}

許可後にリダイレクトされた URL の code= の値を貼り付けてください。
MSG
read -r -p "code: " CODE

NOW_MS="$(( $(date +%s) * 1000 ))"
RESPONSE="$(curl -sS -F grant_type=authorization_code -F "code=${CODE}" -F "client_id=${CLIENT_ID}" -F "client_secret=${CLIENT_SECRET}" https://api.tumblr.com/v2/oauth2/token)"

python3 - "$RESPONSE" "$NOW_MS" <<'PY'
import json, sys
body = json.loads(sys.argv[1])
now_ms = int(sys.argv[2])
if "access_token" not in body:
    print("トークン交換に失敗しました:", json.dumps(body, ensure_ascii=False))
    sys.exit(1)
print()
print("HTTP Shortcuts の変数に貼る値:")
print("tumblr_access_token      =", body["access_token"])
print("tumblr_refresh_token     =", body["refresh_token"])
print("tumblr_token_expires_at  =", now_ms + body["expires_in"] * 1000)
PY
