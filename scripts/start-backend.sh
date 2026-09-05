#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT/backend"

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

exec node dist/server.js
