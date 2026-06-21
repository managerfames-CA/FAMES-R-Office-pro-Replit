#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
export PORT="${PORT:-8000}"

python -m pip install -r requirements.txt
corepack enable >/dev/null 2>&1 || true
if [ ! -d node_modules ]; then
  pnpm install --frozen-lockfile
fi
pnpm run build:ui
exec python main.py
