#!/usr/bin/env bash
set -euo pipefail
rm -rf node_modules .cache dist build .vite
rm -rf artifacts/*/node_modules artifacts/*/dist artifacts/*/.vite
rm -f .replit.nix
printf "Replit build caches removed. Reinstall dependencies and run B Bot.\n"
