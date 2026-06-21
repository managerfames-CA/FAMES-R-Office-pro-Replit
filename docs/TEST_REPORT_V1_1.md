# Test Report — B Bot Replit Integrated V1.1

Date: 21 June 2026

## Passed

- Python compile/import validation: PASS
- Backend automated tests: 18/18 PASS
- Fresh temporary SQLite database tests: PASS
- One-active-symbol database constraint test: PASS
- Cooldown timezone normalization test: PASS
- Price Action midpoint rule test: PASS
- Breakout retest persistence rule test: PASS
- TP stage full-quantity requirement test: PASS
- Short-trade exit-price direction test: PASS
- Local FastAPI startup: PASS
- `/api/healthz`: HTTP 200
- `/api/settings`: HTTP 200
- Restart scanner state: STOPPED
- Environment: DEMO
- Real mode: disabled
- Frontend TS/TSX syntax transpilation: PASS (76 files)

## Environment-blocked checks

- Full pnpm install, TypeScript module-resolution check and Vite production build could not be rerun because the sandbox could not resolve `registry.npmjs.org`.
- Bybit public/private network integration and authenticated Demo order execution could not be run because external DNS was unavailable and no user Demo credentials were supplied.

The preserved `pnpm-lock.yaml`, Replit dependency-install command and frontend build command are included. These blocked checks must be run in Replit with network access.
