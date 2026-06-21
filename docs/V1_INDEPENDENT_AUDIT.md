# Bybit Insw Bot (B Bot) — Independent ZIP and Code Audit

**Audit date:** 21 June 2026  
**Input package:** `Bybit_Intraday_Swing_Bot_Relaxed_Demo_V1_Final.zip`  
**Verified SHA-256:** `1462de23cbaa5185d2d816559adca2d1ffae809cf31439b4cf6d3b22e7bddb9c`

## 1. Final Verdict

**VERDICT: FAIL — NOT READY FOR BYBIT DEMO ORDER EXECUTION**

The package is a small, buildable prototype. It is not a complete or safely operable trading bot. The local Python tests and frontend build pass, but several trading-critical requirements are missing, incorrectly implemented, or only represented by unused classes/modules.

Do not add Bybit Demo credentials and do not start order execution with this ZIP in its current state.

## 2. Independent Checks Re-run

| Check | Independent result |
|---|---|
| ZIP checksum | PASS — matches supplied SHA-256 |
| ZIP extraction | PASS |
| Backend tests | PASS — 12 tests |
| Python compile | PASS |
| Frontend `npm ci` | PASS |
| Frontend TypeScript | PASS |
| Frontend production build | PASS |
| Backend health endpoint | PASS — HTTP 200 |
| Dashboard endpoint | PASS — HTTP 200 |
| Scanner default state | PASS — STOPPED |
| Default write-endpoint authentication | FAIL — write endpoint accepted without token |
| Active-trade database uniqueness | FAIL — two active trades for one symbol were accepted |
| Cooldown persistence after SQLite reload | FAIL — naive/aware datetime comparison raises `TypeError` |
| Authenticated Bybit Demo order lifecycle | NOT RUN — no credentials; unsafe before correction |

## 3. Critical Blockers

### P0-01 — Partial TP/SL API is used as if it can amend existing partial stops

**Files:** `backend/app/bybit.py:57-61`, `backend/app/services.py:258-282`

`set_trading_stop()` always sends `tpslMode='Partial'`. The trade manager then calls it repeatedly for breakeven and trailing updates and treats the call as an amendment.

Bybit documents that Partial mode can only add partial TP/SL orders. Therefore these calls can add new stop orders instead of replacing the old stop. The code does not track or cancel the old stop order IDs. This can leave multiple conflicting stop orders.

**Required correction:** use an explicitly designed and tested protection model. Track exchange order IDs. Do not treat a Partial-mode request as an amendment. Verify the final effective stop/order set from Bybit after every protection change.

### P0-02 — TP1 and TP2 are not verified

**File:** `backend/app/services.py:175-187`

The code sets `tp1_ok=True` and `tp2_ok=True` immediately after the REST calls return. It does not query open orders, order history, or exchange order IDs. The Bybit trading-stop endpoint returns no protection-order details that prove the two targets exist with correct price and quantity.

The local trade may be marked `PROTECTED` when TP1/TP2 are absent or invalid.

### P0-03 — Execution, fees and realized PnL accounting are not implemented

**Files:** `backend/app/models.py:88-113`, `backend/app/services.py:243-323`

`OrderRecord` and `Execution` tables exist, but no application code inserts records into them. The client has an `executions()` method, but it is never called.

When a position disappears, `close_trade_accounting()` receives the existing `trade.realized_pnl`, which is never synchronized from Bybit and normally remains zero. As a result:

- Trade history PnL is unreliable.
- Fees are not recorded.
- TP1/TP2 fills are not proven by executions.
- The four-full-risk-loss daily lock cannot work reliably.
- Strategy performance cannot be evaluated.

### P0-04 — Entry acknowledgement, partial fill and unknown-order recovery are incomplete

**Files:** `backend/app/services.py:189-225`, `backend/app/bybit.py:44-52`

The flow submits a market order, waits for any open position, and treats the position size/average as the completed entry. It does not:

- Query order state by `orderLinkId` after timeout.
- Aggregate executions.
- Calculate fill percentage.
- Apply the approved 90% partial-fill policy.
- Resolve a late fill after the 10-second timeout.
- Cancel or reconcile an uncertain order before allowing later activity.

A late fill can create an exchange position after the local trade was marked `ENTRY_UNFILLED`.

### P0-05 — Private/Public WebSocket implementation is dead code

**Files:** `backend/app/websocket_service.py`, `backend/app/main.py:13-20`

`BybitWebSocketService` is never imported, instantiated or started. There is no event handler for order, execution, position or wallet messages.

The dashboard fields `public_ws` and `private_ws` are instead set to true by REST calls in `health_checks()`, so the UI can report WebSocket health without any WebSocket connection.

### P0-06 — Reconciliation is only an existence check and can finalize trades with zero PnL

**File:** `backend/app/services.py:70-84, 285-295`

Reconciliation compares only whether a symbol exists locally and on Bybit. It does not compare:

- Side and quantity.
- Average entry.
- Leverage/margin mode.
- Stop and TP orders.
- Order IDs and executions.
- Fees and closed PnL.

The manager runs reconciliation before trade management. If an exchange-side position has closed, reconciliation changes the local state, then trade management closes the trade using the stale local PnL value, usually zero.

### P0-07 — Cooldown does not survive restart

**Files:** `backend/app/models.py:115-120`, `backend/app/services.py:194-195`

SQLite reloads the stored datetime without timezone information. The code compares that naive datetime with an aware UTC datetime, raising:

`TypeError: can't compare offset-naive and offset-aware datetimes`

This was independently reproduced. The claimed cooldown persistence is false.

### P0-08 — One-active-trade-per-symbol is not database-enforced

**File:** `backend/app/models.py:86`

`ix_one_active_symbol` is a normal non-unique index. It does not prevent two active rows for one symbol. The check-before-insert is not protected by a transaction or symbol lock.

This was independently reproduced: SQLite accepted two active `BTCUSDT` trades.

## 4. Major Defects

### P1-01 — Strategy lifecycle does not match the deterministic specification

**Files:** `backend/app/strategy.py`, `backend/app/services.py:93-125`

Only the latest 1H candle is evaluated. Active setups are not persisted. Therefore setups cannot reliably remain active for 8 or 12 future 15M candles across the next 1H candle or restart.

The code also omits several specified rules:

- Setup invalidation across candles.
- EMA Rejection confirmation close relative to setup EMA.
- Price Action midpoint confirmation.
- Trend Pullback previous-15M-high/low confirmation rule.
- S/R confirmation relative to the reference level.
- Breakout retest followed by a later confirmation; current logic requires retest and confirmation on the same current candle.

### P1-02 — Actual post-fill risk is not re-sized to 1%

**File:** `backend/app/services.py:196-223`

After the actual average fill is known, the code only rechecks the 0.20%-3.00% stop-distance range. It does not recalculate total loss, fees and quantity and does not reduce the position when actual risk exceeds 1%.

### P1-03 — The 0.30% exchange parameter is not a signal-reference slippage guard

**File:** `backend/app/bybit.py:53-54`

Bybit applies percent slippage tolerance from the current best ask/bid at order submission, not from the bot's stored 15M signal close. The code has no separate comparison against the signal-reference price.

### P1-04 — TP prices are not tick-rounded

**File:** `backend/app/services.py:201-223`

TP1 and TP2 are calculated but not rounded to the instrument tick size before submission. Valid signals can be rejected by Bybit or result in inconsistent target prices.

### P1-05 — Instrument constraints are incomplete

The entry logic does not consistently enforce:

- Overall minimum notional.
- TP1/TP2 minimum notional.
- Maximum market quantity.
- Liquidation-price relationship.
- Current symbol/account leverage constraints beyond a basic max value.

### P1-06 — One-Way, Isolated and auto-add-margin requirements are not checked

The Bybit client contains no account-info, switch-position-mode, set-margin-mode, or auto-add-margin workflow. Scanner startup does not verify the approved account configuration.

### P1-07 — Scanner may start without Demo credentials

**File:** `backend/app/services.py:86-91, 298-311`

Missing credentials return a non-failing health result. Startup can proceed to `RUNNING`; subsequent trade attempts fail during account access. The scanner status therefore does not prove execution readiness.

### P1-08 — Top-50 refresh is not scheduled every 24 hours

**Files:** `backend/app/config.py:20`, `backend/app/services.py:34-49, 298-307`

The 24-hour setting is never used. The universe refreshes only when Start Scanner is pressed.

### P1-09 — No REST rate limiter or bounded retry framework

The scanner fetches two complete kline datasets for each of 50 symbols every 30 seconds. That is roughly 100 market-data requests per cycle, plus account/position requests. There is no endpoint-specific rate limiter, response-header handling or backoff in the REST client.

### P1-10 — Server-time drift is not enforced

A server-time endpoint is called, but local-vs-exchange drift is never calculated. Signed requests can fail without the promised clock-drift safety gate.

### P1-11 — Security control is unusable or insecure depending on configuration

**Files:** `backend/app/config.py:25`, `backend/app/main.py:25-26`, `frontend/src/api.ts:2`

- With the default `change-me`, write endpoints bypass authentication completely.
- With the `.env.example` token, the frontend has no login/token input or documented setup. Buttons send an empty token unless the user manually edits browser local storage.
- Read endpoints expose account/trade data without authentication.

### P1-12 — Global safety lock has no reliable recovery path

TP failure, emergency close and external positions can set `global_entry_lock`, but reconciliation does not automatically clear it and the UI provides no reviewed unlock workflow.

### P1-13 — Database migration is not a real schema migration

`backend/migrations/001_initial.sql` only creates a `schema_migrations` marker. Actual tables are created by `Base.metadata.create_all()`. Schema upgrades and rollback are not controlled.

### P1-14 — Financial values are persisted as binary floats

Prices, quantities and PnL are stored as `Float`. This conflicts with the document's decimal-precision requirement and can cause rounding differences in exchange-critical values.

### P1-15 — Project identity is mixed with another bot

**Files:** `backend/app/config.py:5`, `frontend/src/App.tsx:3`

The required project name is **Bybit Insw Bot (B Bot)**, but the UI brand says **TRADEX** and the backend title uses a generic older name. This directly violates the separation requirement.

## 5. Test and Report Audit

The 12 tests genuinely pass, but they are narrow formula tests. They do not test:

- Bybit request/response contracts.
- Order timeout/late fill.
- Partial fills.
- Protection order verification.
- TP1/TP2 execution handling.
- Breakeven/trailing replacement safety.
- PnL/fee synchronization.
- WebSocket events/reconnect.
- Reconciliation corrections.
- Duplicate-entry concurrency.
- Cooldown persistence after process restart.
- Admin authorization.

The `test_scanner_restart` test manually changes a database field to STOPPED; it does not test FastAPI lifespan restart behavior.

The QA report's `CONDITIONAL PASS` is too generous for a trading system. Build success is valid, but exchange-critical functionality is not merely untested; several paths are absent or technically incorrect.

## 6. Package Cleanliness

Mostly clean, but `frontend/tsconfig.app.tsbuildinfo` is a TypeScript build-cache file and should not be in the final clean ZIP. It is also not ignored by `.gitignore`.

## 7. What Is Usable

The following can be retained as a prototype foundation:

- Basic FastAPI and React structure.
- Demo REST host enforcement.
- Real-mode disabled flag.
- Basic deterministic candle/EMA/swing helper functions.
- Basic risk-sizing functions.
- Basic UI page shell.
- SHA/checksum packaging.

## 8. Required Correction Order

1. Redesign and test exchange-side protection lifecycle.
2. Implement order/execution/fee/closed-PnL persistence and reconciliation.
3. Implement robust entry state machine for accepted, partial, late and unknown fills.
4. Wire private WebSocket streams and REST recovery.
5. Fix reconciliation before any Demo order testing.
6. Fix cooldown timezone persistence and database active-trade uniqueness.
7. Complete deterministic setup lifecycle/invalidation rules.
8. Enforce account mode, margin mode, leverage and instrument constraints.
9. Fix post-fill 1% risk correction and tick/quantity rounding.
10. Fix authentication and B Bot branding.
11. Expand tests substantially.
12. Only then run controlled Bybit Demo end-to-end validation.

## 9. Acceptance Status

| Area | Status |
|---|---|
| Source package integrity | PASS |
| Backend/frontend build | PASS |
| UI prototype | PASS WITH DEFECTS |
| Strategy engine | INCOMPLETE |
| Risk engine | PARTIAL |
| Bybit execution | NOT ACCEPTED |
| Exchange protection | FAIL |
| Trade management | FAIL |
| Reconciliation | FAIL |
| Daily loss guard | NOT OPERATIONAL |
| Cooldown persistence | FAIL |
| Security | FAIL FOR ONLINE DEPLOYMENT |
| Demo operational readiness | FAIL |
| Real-money readiness | NOT APPLICABLE / DISABLED |

**Final classification:** Prototype only. Correction is required before credentials are added or any Bybit Demo order is submitted.
