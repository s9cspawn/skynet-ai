#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:3000}"

echo "API health"
curl --fail-with-body "$API_URL/api/health"
printf '\n\n'

echo "Streaming chat"
curl --fail-with-body -N \
  -H 'Content-Type: application/json' \
  -X POST \
  "$API_URL/api/chat" \
  -d '{"messages":[{"role":"user","content":"Say hello in one sentence."}],"temperature":0.7,"topP":0.95,"maxTokens":128}'
printf '\n'
