#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  exec sudo "$0" "$@"
fi

if [[ -f /etc/local-ai-chat/api.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source /etc/local-ai-chat/api.env
  set +a
fi

readonly LLAMA_BASE_URL="${LLAMA_BASE_URL:?LLAMA_BASE_URL must be set in /etc/local-ai-chat/api.env}"
readonly EXPECTED_MODEL="${LLAMA_MODEL:?LLAMA_MODEL must be set in /etc/local-ai-chat/api.env}"
readonly MODEL_HEALTH_URL="${LLAMA_BASE_URL%/}/api/health"
readonly MODEL_LIST_URL="${LLAMA_BASE_URL%/}/v1/models"
readonly API_HEALTH_URL='http://127.0.0.1:3000/api/health'
readonly WAIT_SECONDS=600

curl_auth=()
if [[ -n "${LLAMA_API_KEY:-}" ]]; then
  curl_auth=(-H "Authorization: Bearer ${LLAMA_API_KEY}")
fi

log() { printf '[skynet] %s\n' "$*"; }

log 'Waiting for Unsloth Studio to become ready...'
for ((elapsed = 0; elapsed < WAIT_SECONDS; elapsed += 2)); do
  if curl --fail --silent --max-time 3 "${curl_auth[@]}" "$MODEL_HEALTH_URL" >/dev/null; then
    log "Model ready after ${elapsed}s."
    break
  fi
  sleep 2
done

if ! curl --fail --silent --max-time 3 "${curl_auth[@]}" "$MODEL_HEALTH_URL" >/dev/null; then
  log 'Unsloth Studio did not become ready. Start the Unsloth model on Windows, then rerun this check.'
  exit 1
fi

if ! curl --fail --silent --max-time 3 "${curl_auth[@]}" "$MODEL_LIST_URL" | grep -Fq '"id":"'"$EXPECTED_MODEL"'"'; then
  log "Unsloth Studio is healthy but did not expose the expected model ($EXPECTED_MODEL)."
  curl --silent --max-time 3 "${curl_auth[@]}" "$MODEL_LIST_URL" || true
  exit 1
fi
log "Loaded model: $EXPECTED_MODEL."

# During boot, systemd starts these units after this readiness check. A manual
# run starts them here as well.
if [[ ${1:-} != '--systemd' ]]; then
  log 'Starting the Skynet API and Nginx...'
  nginx -t
  systemctl start local-ai-chat-api.service nginx.service
fi

if systemctl is-active --quiet local-ai-chat-api.service; then
  for ((elapsed = 0; elapsed < 30; elapsed += 1)); do
    curl --fail --silent --max-time 3 "$API_HEALTH_URL" >/dev/null && break
    sleep 1
  done

  if ! curl --fail --silent --max-time 3 "$API_HEALTH_URL" >/dev/null; then
    log 'The Skynet API did not become healthy. Recent service output follows:'
    journalctl -u local-ai-chat-api.service -n 50 --no-pager
    exit 1
  fi
fi

log 'Startup check complete.'
