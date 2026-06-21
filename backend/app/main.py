from __future__ import annotations

import asyncio
import json
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .bybit import BybitClient
from .config import settings
from .database import Base, SessionLocal, engine, get_db
from .models import (
    AuditEvent,
    Cooldown,
    DailyRiskLedger,
    Execution,
    JournalNote,
    OrderRecord,
    ReconciliationRun,
    Signal,
    StrategySetup,
    SystemConfig,
    Trade,
    UniverseSymbol,
)
from .services import (
    as_utc,
    audit,
    close_trade_manually,
    dec,
    get_config,
    manager_loop,
    reconcile,
    refresh_universe,
    risk_ledger,
    runtime,
    start_scanner,
    stop_scanner,
    trade_net_pnl,
    utcnow,
)
from .websocket_service import BybitWebSocketService


class ScannerUpdate(BaseModel):
    running: bool | None = None
    autoTrading: bool | None = None


class SettingsUpdate(BaseModel):
    startingCapital: float | None = Field(default=None, gt=0)
    riskPerTrade: float | None = None
    maxActiveTrades: int | None = None
    scannerEnabled: bool | None = None
    autoTradingEnabled: bool | None = None
    allowedStrategies: list[str] | None = None
    sessionLossStop: float | None = None
    sessionProfitStop: float | None = None
    telegramEnabled: bool | None = None
    telegramChatId: str | None = None
    minGradeToTrade: str | None = None


class JournalUpdate(BaseModel):
    userNotes: str | None = None
    aiReview: str | None = None
    mistakeSummary: str | None = None


async def websocket_handler(message: dict) -> None:
    if message.get("topic") == "system.websocket":
        if message.get("private"):
            runtime.private_ok = message.get("type") == "connected"
        else:
            runtime.public_ok = message.get("type") == "connected"
        if message.get("type") == "error":
            runtime.last_error = str(message.get("error"))
        return
    topic = str(message.get("topic") or "")
    if topic.startswith(("order", "execution", "position", "wallet")):
        runtime.private_ok = True


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.validate_safety()
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        config = get_config(db)
        config.scanner_state = "STOPPED"
        db.commit()
        audit(db, "APPLICATION_STARTED", detail={"environment": "DEMO", "scanner_state": "STOPPED"})

    runtime.manager_task = asyncio.create_task(manager_loop(SessionLocal))
    ws_service = BybitWebSocketService(websocket_handler)
    runtime.public_ws_task = asyncio.create_task(ws_service.run_public())
    if settings.bybit_api_key and settings.bybit_api_secret:
        runtime.private_ws_task = asyncio.create_task(ws_service.run_private())

    yield

    ws_service.stop()
    for task in (runtime.scanner_task, runtime.manager_task, runtime.public_ws_task, runtime.private_ws_task):
        if task:
            task.cancel()
    await asyncio.gather(
        *(task for task in (runtime.scanner_task, runtime.manager_task, runtime.public_ws_task, runtime.private_ws_task) if task),
        return_exceptions=True,
    )


app = FastAPI(title=settings.app_name, version="1.1.0", lifespan=lifespan)
origins = ["*"] if settings.frontend_origin == "*" else [item.strip() for item in settings.frontend_origin.split(",") if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=settings.frontend_origin != "*",
    allow_methods=["*"],
    allow_headers=["*"],
)


def admin(x_admin_token: str | None = Header(default=None)) -> None:
    if not settings.app_admin_token:
        raise HTTPException(503, "APP_ADMIN_TOKEN is not configured in Replit Secrets")
    if x_admin_token != settings.app_admin_token:
        raise HTTPException(401, "Invalid app control token")


def number(value) -> float:
    return float(dec(value))


def iso(value: datetime | None) -> str | None:
    value = as_utc(value)
    return value.isoformat() if value else None


def strategy_names(raw: str) -> list[str]:
    try:
        value = json.loads(raw)
        return value if isinstance(value, list) else [str(value)]
    except Exception:
        return [raw] if raw else []


def signal_response(signal: Signal) -> dict:
    strategies = strategy_names(signal.matched_strategies)
    confirmation = strategy_names(signal.confirmation)
    return {
        "id": signal.id,
        "symbol": signal.symbol,
        "grade": "VALID",
        "strategy": strategies[0] if strategies else "Unknown",
        "direction": signal.direction,
        "entryPrice": number(signal.reference_price),
        "stopLoss": number(signal.stop_price),
        "tp1": number(signal.tp1_price),
        "tp2": number(signal.tp2_price),
        "riskRewardRatio": 2.0,
        "confidence": 100,
        "aiReason": f"Matched: {', '.join(strategies)} | Confirmation: {', '.join(confirmation)}",
        "status": "executed" if signal.status == "EXECUTED" else "rejected" if signal.status in {"REJECTED", "UNFILLED"} else "pending",
        "createdAt": iso(signal.created_at),
        "expiresAt": None,
    }


def trade_response(trade: Trade) -> dict:
    pnl = number(trade.realized_pnl if trade.closed_at else trade.unrealized_pnl)
    notional = number(trade.avg_entry) * max(number(trade.original_qty), 0.0)
    pnl_percent = pnl / notional * 100 if notional else 0.0
    return {
        "id": trade.id,
        "signalId": trade.signal_id,
        "symbol": trade.symbol,
        "direction": trade.side,
        "strategy": ", ".join(strategy_names(trade.strategy)),
        "grade": "VALID",
        "entryPrice": number(trade.avg_entry),
        "quantity": number(trade.original_qty),
        "stopLoss": number(trade.initial_stop),
        "tp1": number(trade.tp1),
        "tp2": number(trade.tp2),
        "currentSl": number(trade.current_stop),
        "currentPrice": None,
        "pnl": pnl,
        "pnlPercent": pnl_percent,
        "exitPrice": number(trade.exit_price) if trade.exit_price is not None else None,
        "exitReason": trade.exit_reason,
        "status": "closed" if trade.closed_at else "open",
        "tp1Hit": trade.tp1_hit,
        "tp2Hit": trade.tp2_hit,
        "riskAmount": number(trade.initial_risk_amount),
        "aiReason": f"State: {trade.state}; Protection: {trade.protection_status}; Leverage: {trade.leverage}x",
        "openedAt": iso(trade.opened_at),
        "closedAt": iso(trade.closed_at),
        "protectionStatus": trade.protection_status,
        "state": trade.state,
        "leverage": trade.leverage,
        "remainingQuantity": number(trade.remaining_qty),
        "lastSync": iso(trade.last_sync),
    }


@app.get("/api/healthz")
@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    config = get_config(db)
    return {
        "status": "ok",
        "app": "Bybit Insw Bot",
        "environment": "DEMO",
        "realMode": False,
        "scannerState": config.scanner_state,
        "publicWs": runtime.public_ok,
        "privateWs": runtime.private_ok,
        "lastReconciliation": iso(runtime.last_reconciliation),
        "credentialsConfigured": bool(settings.bybit_api_key and settings.bybit_api_secret),
        "lastError": runtime.last_error,
    }


@app.get("/api/scanner/status")
def scanner_status(db: Session = Depends(get_db)):
    config = get_config(db)
    today = datetime.now(timezone.utc).date()
    signals_today = db.scalar(select(func.count()).select_from(Signal).where(func.date(Signal.created_at) == today.isoformat())) or 0
    rejected_today = db.scalar(
        select(func.count()).select_from(Signal).where(
            func.date(Signal.created_at) == today.isoformat(),
            Signal.status.in_(["REJECTED", "UNFILLED"]),
        )
    ) or 0
    scanned = db.scalar(select(func.count()).select_from(UniverseSymbol).where(UniverseSymbol.last_scanned_at.is_not(None))) or 0
    return {
        "running": config.scanner_state == "RUNNING",
        "autoTrading": config.scanner_state == "RUNNING",
        "pairsScanned": scanned,
        "lastScanAt": iso(config.last_scan_at),
        "signalsFoundToday": signals_today,
        "rejectedToday": rejected_today,
        "state": config.scanner_state,
        "globalEntryLock": config.global_entry_lock,
        "lockReason": config.lock_reason,
    }


@app.patch("/api/scanner/status", dependencies=[Depends(admin)])
async def update_scanner(body: ScannerUpdate, db: Session = Depends(get_db)):
    target = body.running if body.running is not None else body.autoTrading
    try:
        if target:
            await start_scanner(db, SessionLocal)
        elif target is False:
            stop_scanner(db)
    except Exception as exc:
        raise HTTPException(409, str(exc)) from exc
    return scanner_status(db)


@app.post("/api/scanner/start", dependencies=[Depends(admin)])
async def start_scanner_route(db: Session = Depends(get_db)):
    try:
        return await start_scanner(db, SessionLocal)
    except Exception as exc:
        raise HTTPException(409, str(exc)) from exc


@app.post("/api/scanner/stop", dependencies=[Depends(admin)])
def stop_scanner_route(db: Session = Depends(get_db)):
    return stop_scanner(db)


@app.get("/api/scanner/pairs")
def scanned_pairs(db: Session = Depends(get_db)):
    rows = db.scalars(select(UniverseSymbol).order_by(UniverseSymbol.rank)).all()
    return [
        {
            "symbol": row.symbol,
            "grade": "VALID" if row.last_strategy else None,
            "strategy": row.last_strategy,
            "lastPrice": number(row.last_price),
            "priceChangePercent": number(row.price_change_pct),
            "volume24h": number(row.volume24h),
            "scannedAt": iso(row.last_scanned_at or row.snapshot_at),
            "trend": row.last_trend,
            "rank": row.rank,
        }
        for row in rows
    ]


@app.get("/api/signals")
def signals(limit: int = Query(default=20, ge=1, le=500), grade: str | None = None, db: Session = Depends(get_db)):
    del grade
    rows = db.scalars(select(Signal).order_by(Signal.id.desc()).limit(limit)).all()
    return [signal_response(row) for row in rows]


@app.get("/api/signals/best")
def best_signal(db: Session = Depends(get_db)):
    row = db.scalar(select(Signal).where(Signal.status.in_(["CREATED", "EXECUTED"])).order_by(Signal.id.desc()))
    if row is None:
        raise HTTPException(204)
    return signal_response(row)


@app.post("/api/signals/{signal_id}/execute", dependencies=[Depends(admin)])
async def execute_signal_route(signal_id: int, db: Session = Depends(get_db)):
    signal = db.get(Signal, signal_id)
    if signal is None:
        raise HTTPException(404, "Signal not found")
    if signal.status == "EXECUTED":
        trade = db.scalar(select(Trade).where(Trade.signal_id == signal.id))
        return trade_response(trade) if trade else signal_response(signal)
    raise HTTPException(409, "B Bot executes eligible signals automatically while the scanner is RUNNING")


@app.get("/api/trades")
def trades(status: str | None = None, limit: int = Query(default=50, ge=1, le=500), db: Session = Depends(get_db)):
    query = select(Trade).order_by(Trade.id.desc())
    if status == "open":
        query = query.where(Trade.closed_at.is_(None))
    elif status == "closed":
        query = query.where(Trade.closed_at.is_not(None))
    rows = db.scalars(query.limit(limit)).all()
    return [trade_response(row) for row in rows]


@app.get("/api/trades/open")
def open_trades(db: Session = Depends(get_db)):
    rows = db.scalars(select(Trade).where(Trade.closed_at.is_(None)).order_by(Trade.id.desc())).all()
    return [trade_response(row) for row in rows]


@app.get("/api/trades/{trade_id}")
def get_trade(trade_id: int, db: Session = Depends(get_db)):
    trade = db.get(Trade, trade_id)
    if trade is None:
        raise HTTPException(404, "Trade not found")
    return trade_response(trade)


@app.post("/api/trades/{trade_id}/close", dependencies=[Depends(admin)])
async def close_trade(trade_id: int, db: Session = Depends(get_db)):
    trade = db.get(Trade, trade_id)
    if trade is None:
        raise HTTPException(404, "Trade not found")
    client = BybitClient()
    try:
        await close_trade_manually(db, client, trade)
        db.refresh(trade)
        return trade_response(trade)
    except Exception as exc:
        raise HTTPException(409, str(exc)) from exc
    finally:
        await client.close()


@app.get("/api/journal")
def journal(limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    rows = db.scalars(select(Trade).order_by(Trade.id.desc()).offset(offset).limit(limit)).all()
    output = []
    for trade in rows:
        note = db.get(JournalNote, trade.id)
        output.append(
            {
                "id": trade.id,
                "tradeId": trade.id,
                "symbol": trade.symbol,
                "direction": trade.side,
                "strategy": ", ".join(strategy_names(trade.strategy)),
                "grade": "VALID",
                "entryPrice": number(trade.avg_entry),
                "exitPrice": number(trade.exit_price) if trade.exit_price is not None else None,
                "quantity": number(trade.original_qty),
                "pnl": number(trade.realized_pnl) if trade.closed_at else None,
                "exitReason": trade.exit_reason,
                "aiReason": f"Protection: {trade.protection_status}; State: {trade.state}",
                "aiReview": note.review if note else None,
                "mistakeSummary": note.mistake_summary if note else None,
                "userNotes": note.user_notes if note else None,
                "openedAt": iso(trade.opened_at),
                "closedAt": iso(trade.closed_at),
            }
        )
    return output


@app.get("/api/journal/{trade_id}")
def journal_entry(trade_id: int, db: Session = Depends(get_db)):
    entries = journal(500, 0, db)
    entry = next((item for item in entries if item["tradeId"] == trade_id), None)
    if entry is None:
        raise HTTPException(404, "Journal entry not found")
    return entry


@app.patch("/api/journal/{trade_id}", dependencies=[Depends(admin)])
def update_journal(trade_id: int, body: JournalUpdate, db: Session = Depends(get_db)):
    if db.get(Trade, trade_id) is None:
        raise HTTPException(404, "Trade not found")
    note = db.get(JournalNote, trade_id) or JournalNote(trade_id=trade_id)
    note.user_notes = body.userNotes
    note.review = body.aiReview
    note.mistake_summary = body.mistakeSummary
    db.merge(note)
    db.commit()
    return journal_entry(trade_id, db)


@app.get("/api/dashboard/stats")
def dashboard_stats(db: Session = Depends(get_db)):
    config = get_config(db)
    ledger = risk_ledger(db)
    trades_all = db.scalars(select(Trade)).all()
    closed = [trade for trade in trades_all if trade.closed_at is not None]
    total_pnl = sum((dec(trade.realized_pnl) for trade in closed), Decimal("0"))
    open_count = sum(1 for trade in trades_all if trade.closed_at is None)
    wins = sum(1 for trade in closed if dec(trade.realized_pnl) > 0)
    win_rate = wins / len(closed) * 100 if closed else 0.0
    best = db.scalar(select(Signal).order_by(Signal.id.desc()))
    capital = dec(config.bot_trading_capital)
    today_pnl = dec(ledger.realized_pnl)
    return {
        "balance": number(capital + total_pnl),
        "startingBalance": number(capital),
        "totalPnl": number(total_pnl),
        "todayPnl": number(today_pnl),
        "todayPnlPercent": number(today_pnl / capital * 100) if capital else 0.0,
        "winRate": win_rate,
        "totalTrades": len(closed),
        "openTradesCount": open_count,
        "sessionPnl": number(today_pnl),
        "sessionPnlPercent": number(today_pnl / capital * 100) if capital else 0.0,
        "sessionStatus": "active" if config.scanner_state == "RUNNING" else "idle",
        "bestSignalSymbol": best.symbol if best else None,
        "bestSignalGrade": "VALID" if best else None,
        "winStreak": 0,
        "lossStreak": ledger.full_risk_losses,
        "globalEntryLock": config.global_entry_lock,
        "lockReason": config.lock_reason,
        "environment": "DEMO",
    }


@app.get("/api/dashboard/performance")
def performance(days: int = Query(default=30, ge=1, le=365), db: Session = Depends(get_db)):
    config = get_config(db)
    capital = dec(config.bot_trading_capital)
    rows = db.scalars(select(Trade).where(Trade.closed_at.is_not(None)).order_by(Trade.closed_at)).all()
    cutoff = utcnow().date() - timedelta(days=days - 1)
    by_day: dict[str, dict] = {}
    running = capital
    for trade in rows:
        closed_at = as_utc(trade.closed_at)
        if closed_at is None:
            continue
        running += dec(trade.realized_pnl)
        key = closed_at.date().isoformat()
        if closed_at.date() >= cutoff:
            item = by_day.setdefault(key, {"date": key, "balance": number(running), "pnl": 0.0, "trades": 0})
            item["balance"] = number(running)
            item["pnl"] += number(trade.realized_pnl)
            item["trades"] += 1
    return list(by_day.values())


@app.get("/api/dashboard/strategy-breakdown")
def strategy_breakdown(db: Session = Depends(get_db)):
    closed = db.scalars(select(Trade).where(Trade.closed_at.is_not(None))).all()
    stats: dict[str, dict] = {}
    for trade in closed:
        names = strategy_names(trade.strategy) or ["Unknown"]
        for name in names:
            item = stats.setdefault(name, {"strategy": name, "wins": 0, "losses": 0, "totalPnl": 0.0, "winRate": 0.0, "avgRR": 0.0})
            pnl = number(trade.realized_pnl)
            item["wins" if pnl > 0 else "losses"] += 1
            item["totalPnl"] += pnl
    for item in stats.values():
        total = item["wins"] + item["losses"]
        item["winRate"] = item["wins"] / total * 100 if total else 0.0
        item["avgRR"] = 0.0
    return list(stats.values())


@app.get("/api/session")
def session(db: Session = Depends(get_db)):
    stats = dashboard_stats(db)
    return {
        "id": 1,
        "startBalance": stats["startingBalance"],
        "currentBalance": stats["balance"],
        "pnl": stats["sessionPnl"],
        "pnlPercent": stats["sessionPnlPercent"],
        "status": stats["sessionStatus"],
        "stopReason": get_config(db).lock_reason,
        "tradesCount": stats["totalTrades"],
        "startedAt": utcnow().replace(hour=0, minute=0, second=0, microsecond=0).isoformat(),
        "endedAt": None,
    }


@app.post("/api/session", dependencies=[Depends(admin)])
def start_session(db: Session = Depends(get_db)):
    return session(db)


@app.patch("/api/session", dependencies=[Depends(admin)])
def reset_session(db: Session = Depends(get_db)):
    return session(db)


@app.get("/api/settings")
def get_settings(db: Session = Depends(get_db)):
    config = get_config(db)
    return {
        "startingCapital": number(config.bot_trading_capital),
        "riskPerTrade": 1.0,
        "sessionLossStop": 4.0,
        "sessionProfitStop": 0.0,
        "maxActiveTrades": 3,
        "autoTradingEnabled": config.scanner_state == "RUNNING",
        "scannerEnabled": config.scanner_state == "RUNNING",
        "telegramEnabled": False,
        "telegramChatId": None,
        "minGradeToTrade": "VALID",
        "allowedStrategies": [
            "EMA_REJECTION",
            "PRICE_ACTION",
            "TREND_PULLBACK",
            "BREAKOUT_RETEST",
            "SUPPORT_RESISTANCE_REJECTION",
        ],
        "environment": "DEMO",
        "maxLeverage": 5,
        "cooldownHours": 4,
        "appControlTokenConfigured": bool(settings.app_admin_token),
    }


@app.patch("/api/settings", dependencies=[Depends(admin)])
def update_settings(body: SettingsUpdate, db: Session = Depends(get_db)):
    if body.riskPerTrade is not None and body.riskPerTrade != 1.0:
        raise HTTPException(400, "Risk per trade is locked at 1%")
    if body.maxActiveTrades is not None and body.maxActiveTrades != 3:
        raise HTTPException(400, "Maximum open trades is locked at 3")
    config = get_config(db)
    if body.startingCapital is not None:
        config.bot_trading_capital = Decimal(str(body.startingCapital))
        audit(db, "BOT_TRADING_CAPITAL_UPDATED", detail={"value": body.startingCapital})
    db.commit()
    return get_settings(db)


@app.get("/api/logs")
def logs(limit: int = Query(default=100, ge=1, le=1000), db: Session = Depends(get_db)):
    rows = db.scalars(select(AuditEvent).order_by(AuditEvent.id.desc()).limit(limit)).all()
    output = []
    for row in rows:
        try:
            data = json.loads(row.detail)
        except Exception:
            data = {"raw": row.detail}
        level = "error" if "FAILED" in row.event_type or "ERROR" in row.event_type else "trade" if "TRADE" in row.event_type or "SIGNAL" in row.event_type else "info"
        output.append(
            {
                "id": row.id,
                "level": level,
                "message": row.event_type,
                "symbol": data.get("symbol") if isinstance(data, dict) else None,
                "data": data,
                "createdAt": iso(row.created_at),
            }
        )
    return output


@app.get("/api/reconciliation")
def reconciliation_runs(db: Session = Depends(get_db)):
    rows = db.scalars(select(ReconciliationRun).order_by(ReconciliationRun.id.desc()).limit(100)).all()
    return [
        {
            "id": row.id,
            "status": row.status,
            "mismatches": row.mismatches,
            "summary": json.loads(row.summary or "{}"),
            "startedAt": iso(row.started_at),
            "completedAt": iso(row.completed_at),
        }
        for row in rows
    ]


@app.post("/api/reconciliation/run", dependencies=[Depends(admin)])
async def run_reconciliation(db: Session = Depends(get_db)):
    client = BybitClient()
    try:
        return await reconcile(db, client)
    except Exception as exc:
        raise HTTPException(409, str(exc)) from exc
    finally:
        await client.close()


# Serve the preserved Replit React UI from the same FastAPI process.
static_dir = Path(settings.static_dir)
if static_dir.exists():
    assets_dir = static_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str, request: Request):
        if full_path.startswith("api/"):
            raise HTTPException(404)
        candidate = static_dir / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(static_dir / "index.html")
