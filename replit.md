# Replit Runtime — Bybit Insw Bot (B Bot)

## Active architecture

- UI: `artifacts/trading-terminal` (preserved React/Vite UI)
- API/backend: `backend/app` (FastAPI)
- Entry point: `main.py`
- Run workflow: `scripts/run-bbot.sh`
- Database: `DATABASE_URL`; B Bot uses `bbot_*` table names so old repository tables are not overwritten

## Required Replit Secrets

- `BYBIT_API_KEY` — Bybit Demo key
- `BYBIT_API_SECRET` — Bybit Demo secret
- `APP_ADMIN_TOKEN` — long random control token
- `DATABASE_URL` — Replit PostgreSQL connection string

## Safety invariants

- `ENVIRONMENT=demo`
- `REAL_MODE_ENABLED=false`
- REST host must be `https://api-demo.bybit.com`
- Risk cannot exceed 1%
- Leverage cannot exceed 5×
- Scanner is STOPPED after every backend restart

## Deploy/run

The `.replit` build installs Python and pnpm dependencies, builds the UI, then serves both UI and API from FastAPI on port 8000.

Do not run the old Drizzle database push command. The old UI workspace files are retained only for UI compatibility; FastAPI/SQLAlchemy is authoritative for B Bot runtime data.
