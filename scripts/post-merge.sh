#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
python -m pip install -r requirements.txt
corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile
pnpm run build:ui
python -m compileall -q backend main.py
PYTHONPATH=backend pytest -q backend/tests
