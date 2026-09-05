#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  exec sudo "$0" "$@"
fi

readonly MODEL_HEALTH_URL='http://127.0.0.1:8080/health'
readonly API_HEALTH_URL='http://127.0.0.1:3000/api/health'
readonly WAIT_SECONDS=600

log() { printf '[skynet] %s\n' "$*"; }

if curl --fail --silent --max-time 3 "$MODEL_HEALTH_URL" >/dev/null; then
  log 'llama.cpp is already healthy.'
else
  log 'Starting llama.cpp...'
  systemctl start llama-server.service
fi

log 'Waiting for the model to become ready...'
for ((elapsed = 0; elapsed < WAIT_SECONDS; elapsed += 2)); do
  if curl --fail --silent --max-time 3 "$MODEL_HEALTH_URL" >/dev/null; then
    log "Model ready after ${elapsed}s."
    break
  fi
  sleep 2
done

if ! curl --fail --silent --max-time 3 "$MODEL_HEALTH_URL" >/dev/null; then
  log 'Model did not become ready. Recent service output follows:'
  journalctl -u llama-server.service -n 50 --no-pager
  exit 1
fi

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
