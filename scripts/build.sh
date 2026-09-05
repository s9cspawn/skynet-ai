#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_ROOT="${DEPLOY_ROOT:-/var/www/local-ai-chat}"

cd "$PROJECT_ROOT"
npm ci
npm run build

BROWSER_DIR="$PROJECT_ROOT/frontend/dist/frontend/browser"
if [[ ! -d "$BROWSER_DIR" ]]; then
  echo "Angular browser output was not found at $BROWSER_DIR" >&2
  exit 1
fi

sudo install -d -m 0755 "$DEPLOY_ROOT/browser"
sudo cp -a "$BROWSER_DIR/." "$DEPLOY_ROOT/browser/"

echo "Built frontend and backend. Angular assets are in $DEPLOY_ROOT/browser."
