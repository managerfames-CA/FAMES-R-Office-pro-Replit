# Bybit Insw Bot (B Bot) — Replit/GitHub Integrated V1.1

B Bot is a **Bybit Demo-only** intraday swing trading application. This package preserves the existing Replit React trading-terminal UI and replaces the old Binance/Streamlit/Express runtime with the audited B Bot FastAPI engine.

## Locked trading scope

- Bybit Demo Trading only
- USDT linear perpetual futures
- One-Way position mode, isolated margin
- Long and Short
- Dynamic leverage 1×–5×, never above 5×
- Closed 1H trend/setup and closed 15M entry/management
- Five OR-linked strategies
- Maximum 1% risk per trade
- Maximum 3 simultaneous trades
- TP1: 50% at 2R; TP2: 30% at 3R; final residual runner
- Four full-risk-loss daily lock
- Manual scanner Start/Stop
- Real mode disabled

## What was preserved

The React/Vite UI under `artifacts/trading-terminal` remains the visual foundation. It was relabelled for B Bot and connected to the new FastAPI compatibility API.

## What was replaced

The old Binance/Testnet, Streamlit scanner, Express API and mock execution runtime are not used. The active runtime is:

```text
React/Vite UI
    ↓ same-origin /api
FastAPI B Bot backend
    ↓
Bybit Demo V5 REST + WebSocket
    ↓
B Bot namespaced database tables (bbot_*)
```

## Replit Secrets

Set these in **Replit → Tools → Secrets**. Never commit them.

```text
BYBIT_API_KEY=<Bybit Demo API key>
BYBIT_API_SECRET=<Bybit Demo API secret>
APP_ADMIN_TOKEN=<a long random control token>
DATABASE_URL=<Replit PostgreSQL URL>
```

The following safety values are already locked by defaults:

```text
ENVIRONMENT=demo
BYBIT_REST_URL=https://api-demo.bybit.com
REAL_MODE_ENABLED=false
MAX_LEVERAGE=5
MAX_OPEN_TRADES=3
RISK_FRACTION=0.01
```

After launch, open **Settings** and enter the same `APP_ADMIN_TOKEN` in the App Control field. It is stored only in that browser and sent to protected control endpoints. Bybit credentials never go to the browser.

## Run on Replit

Press **Run**. The workflow:

1. Installs Python requirements.
2. Installs the existing pnpm workspace.
3. Builds the preserved UI.
4. Starts FastAPI on port 8000.

The scanner always starts as `STOPPED`. Start it manually from the dashboard only after health checks pass.

## Local run

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
corepack enable
pnpm install --frozen-lockfile
pnpm run build:ui
python main.py
```

Open `http://127.0.0.1:8000`.

## Tests

```bash
PYTHONPATH=backend pytest -q backend/tests
python -m compileall -q backend main.py
pnpm run typecheck
pnpm run build:ui
```

## Important operational limitation

Scanner Stop blocks new scans and entries, but position management only continues while the backend is online. Exchange-side SL/TP orders remain on Bybit if the browser closes. However, breakeven movement and the 15M swing-based trailing update require the backend to remain awake after TP1/TP2.

## Safety

- Demo credentials only.
- No withdrawal permission.
- Do not enable real mode in this release.
- Do not push `.env`, database files or secrets to GitHub.
- Complete `docs/DEMO_VALIDATION_CHECKLIST.md` before treating the bot as Demo-operational.


> V1.2 UI replacement: B Bot branding and approved strategy-only presentation; legacy grade/FVG/CHoCH/Liquidity Sweep displays removed.
