from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal as D
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .bybit import BybitClient, BybitError
from .config import settings
from .domain import Candle, ceil_step, floor_step
from .models import (
    AuditEvent,
    Cooldown,
    DailyRiskLedger,
    Execution,
    InstrumentSpec,
    OrderRecord,
    ReconciliationRun,
    Signal,
    StrategySetup,
    SystemConfig,
    Trade,
    UniverseSymbol,
)
from .risk import max_compliant_quantity, size_position, split_quantity, stop_distance_valid
from .strategy import (
    breakout_retest_seen,
    confirmation_matches_setup,
    confirmation_types,
    ema,
    evaluate_1h,
    fingerprint,
    latest_swing,
    setup_invalidated,
    trend,
)


class Runtime:
    def __init__(self) -> None:
        self.scanner_task: asyncio.Task | None = None
        self.manager_task: asyncio.Task | None = None
        self.private_ws_task: asyncio.Task | None = None
        self.public_ws_task: asyncio.Task | None = None
        self.last_reconciliation: datetime | None = None
        self.public_ok = False
        self.private_ok = False
        self.last_error: str | None = None


runtime = Runtime()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def dec(value, default: str = "0") -> D:
    if value is None or value == "":
        return D(default)
    return D(str(value))


def audit(db: Session, event: str, entity: str = "system", entity_id: object = "0", detail: dict | None = None) -> None:
    db.add(
        AuditEvent(
            event_type=event,
            entity_type=entity,
            entity_id=str(entity_id),
            detail=json.dumps(detail or {}, default=str),
        )
    )
    db.commit()


def get_config(db: Session) -> SystemConfig:
    config = db.get(SystemConfig, 1)
    if config is None:
        config = SystemConfig(
            id=1,
            bot_trading_capital=D(str(settings.bot_trading_capital)),
            scanner_state="STOPPED",
        )
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def dhaka_date() -> str:
    return datetime.now(ZoneInfo(settings.timezone)).date().isoformat()


def risk_ledger(db: Session) -> DailyRiskLedger:
    date_key = dhaka_date()
    ledger = db.get(DailyRiskLedger, date_key)
    if ledger is None:
        ledger = DailyRiskLedger(trading_date=date_key)
        db.add(ledger)
        db.commit()
        db.refresh(ledger)
    return ledger


def make_link(prefix: str, trade_id: int | None = None) -> str:
    suffix = uuid.uuid4().hex[:20]
    middle = str(trade_id or "x")
    return f"bb-{prefix}-{middle}-{suffix}"[:36]


def closed_klines(rows: list, minutes: int) -> list[Candle]:
    now_ms = int(utcnow().timestamp() * 1000)
    duration = minutes * 60_000
    candles: list[Candle] = []
    for row in reversed(rows):
        open_time = int(row[0])
        if open_time + duration <= now_ms:
            candles.append(
                Candle(
                    open_time,
                    open_time + duration,
                    D(row[1]),
                    D(row[2]),
                    D(row[3]),
                    D(row[4]),
                    D(row[5]),
                )
            )
    return candles


async def account_values(client: BybitClient) -> tuple[D, D]:
    wallet = (await client.wallet())["result"]["list"][0]
    total = dec(wallet.get("totalEquity"))
    available = dec(wallet.get("totalAvailableBalance") or wallet.get("totalWalletBalance"))
    return total, available


async def refresh_universe(db: Session, client: BybitClient) -> int:
    instruments: list[dict] = []
    cursor: str | None = None
    while True:
        payload = await client.instruments(cursor)
        result = payload["result"]
        instruments.extend(result.get("list", []))
        cursor = result.get("nextPageCursor") or None
        if not cursor:
            break

    tickers = (await client.tickers())["result"]["list"]
    instrument_map = {
        item["symbol"]: item
        for item in instruments
        if item.get("contractType") == "LinearPerpetual"
        and item.get("status") == "Trading"
        and item.get("settleCoin") == "USDT"
        and item.get("symbol", "").endswith("USDT")
    }
    ranked: list[tuple[D, D, dict]] = []
    for ticker in tickers:
        if ticker.get("symbol") not in instrument_map:
            continue
        ranked.append((dec(ticker.get("turnover24h")), dec(ticker.get("volume24h")), ticker))
    ranked.sort(key=lambda item: (item[0], item[1]), reverse=True)
    top = ranked[: settings.universe_size]
    now = utcnow()
    top_symbols = {item[2]["symbol"] for item in top}

    db.execute(delete(UniverseSymbol).where(UniverseSymbol.symbol.not_in(top_symbols)))
    for rank, (_, __, ticker) in enumerate(top, start=1):
        symbol = ticker["symbol"]
        spec = instrument_map[symbol]
        existing = db.get(UniverseSymbol, symbol)
        values = {
            "rank": rank,
            "turnover24h": dec(ticker.get("turnover24h")),
            "volume24h": dec(ticker.get("volume24h")),
            "bid": dec(ticker.get("bid1Price")),
            "ask": dec(ticker.get("ask1Price")),
            "last_price": dec(ticker.get("lastPrice")),
            "price_change_pct": dec(ticker.get("price24hPcnt")) * D("100"),
            "snapshot_at": now,
            "eligible": True,
        }
        if existing:
            for key, value in values.items():
                setattr(existing, key, value)
        else:
            db.add(UniverseSymbol(symbol=symbol, **values))

        lot = spec["lotSizeFilter"]
        price_filter = spec["priceFilter"]
        leverage_filter = spec.get("leverageFilter", {})
        db.merge(
            InstrumentSpec(
                symbol=symbol,
                tick_size=price_filter["tickSize"],
                qty_step=lot["qtyStep"],
                min_qty=lot["minOrderQty"],
                max_market_qty=lot.get("maxMktOrderQty")
                or lot.get("maxMarketOrderQty")
                or lot.get("maxOrderQty"),
                min_notional=lot.get("minNotionalValue", "0"),
                max_leverage=leverage_filter.get("maxLeverage", "5"),
                status=spec["status"],
                updated_at=now,
            )
        )
    db.commit()
    audit(db, "UNIVERSE_REFRESHED", "universe", "current", {"count": len(top)})
    return len(top)


def universe_is_stale(db: Session) -> bool:
    latest = db.scalar(select(func.max(UniverseSymbol.snapshot_at)))
    latest_utc = as_utc(latest)
    return latest_utc is None or utcnow() - latest_utc >= timedelta(hours=settings.universe_refresh_hours)


async def health_checks(db: Session, client: BybitClient) -> dict:
    time_payload = await client.server_time()
    runtime.public_ok = True
    exchange_ms = int(time_payload["result"].get("timeSecond", "0")) * 1000
    local_ms = int(utcnow().timestamp() * 1000)
    drift_ms = abs(exchange_ms - local_ms)
    if exchange_ms and drift_ms > 5_000:
        raise RuntimeError(f"CLOCK_DRIFT_TOO_HIGH:{drift_ms}ms")

    if not settings.bybit_api_key or not settings.bybit_api_secret:
        runtime.private_ok = False
        raise RuntimeError("Bybit Demo API credentials are not configured")

    await client.wallet()
    account = (await client.account_info())["result"]
    margin_mode = account.get("marginMode")
    if margin_mode != "ISOLATED_MARGIN":
        await client.set_margin_mode("ISOLATED_MARGIN")
        account = (await client.account_info())["result"]
        if account.get("marginMode") != "ISOLATED_MARGIN":
            raise RuntimeError("ISOLATED_MARGIN_NOT_CONFIRMED")
    try:
        await client.switch_one_way()
    except BybitError as exc:
        # Bybit can return a harmless "not modified" code when already in one-way mode.
        if "not modified" not in str(exc).lower() and "110025" not in str(exc):
            raise

    runtime.private_ok = True
    await reconcile(db, client)
    return {"public": True, "private": True, "clock_drift_ms": drift_ms, "margin_mode": "ISOLATED_MARGIN"}


async def find_order(client: BybitClient, order_link_id: str, symbol: str | None = None) -> dict | None:
    for payload in (
        await client.open_orders(symbol=symbol, order_link_id=order_link_id, open_only=0),
        await client.order_history(symbol=symbol, order_link_id=order_link_id),
    ):
        for item in payload.get("result", {}).get("list", []):
            if item.get("orderLinkId") == order_link_id:
                return item
    return None


async def sync_order_executions(db: Session, client: BybitClient, trade: Trade, order: OrderRecord) -> None:
    payload = await client.executions(order_link_id=order.order_link_id)
    items = payload.get("result", {}).get("list", [])
    executed_qty = D("0")
    total_value = D("0")
    for item in items:
        exec_id = item.get("execId")
        if not exec_id:
            continue
        price = dec(item.get("execPrice"))
        qty = dec(item.get("execQty"))
        fee = dec(item.get("execFee"))
        pnl = dec(item.get("execPnl"))
        executed_qty += qty
        total_value += price * qty
        if db.scalar(select(Execution).where(Execution.exec_id == exec_id)) is None:
            executed_ms = int(item.get("execTime") or 0)
            executed_at = datetime.fromtimestamp(executed_ms / 1000, timezone.utc) if executed_ms else utcnow()
            db.add(
                Execution(
                    exec_id=exec_id,
                    trade_id=trade.id,
                    order_id=item.get("orderId") or order.exchange_order_id or "",
                    order_link_id=order.order_link_id,
                    side=item.get("side") or order.side,
                    price=price,
                    qty=qty,
                    fee=fee,
                    pnl=pnl,
                    executed_at=executed_at,
                )
            )
    if executed_qty > 0:
        order.executed_qty = executed_qty
        order.avg_price = total_value / executed_qty
        order.status = "FILLED" if executed_qty >= order.requested_qty else "PARTIALLY_FILLED"
    remote = await find_order(client, order.order_link_id, trade.symbol)
    if remote:
        order.exchange_order_id = remote.get("orderId") or order.exchange_order_id
        order.status = remote.get("orderStatus") or order.status
    db.commit()


async def sync_all_executions(db: Session, client: BybitClient, trade: Trade) -> None:
    orders = db.scalars(select(OrderRecord).where(OrderRecord.trade_id == trade.id)).all()
    for order in orders:
        try:
            await sync_order_executions(db, client, trade, order)
        except Exception as exc:
            audit(db, "EXECUTION_SYNC_FAILED", "trade", trade.id, {"order": order.order_link_id, "error": str(exc)})


async def wait_for_entry_fill(db: Session, client: BybitClient, trade: Trade, entry_order: OrderRecord, timeout: int = 10):
    deadline = asyncio.get_running_loop().time() + timeout
    last_position = None
    while asyncio.get_running_loop().time() < deadline:
        await sync_order_executions(db, client, trade, entry_order)
        rows = (await client.positions(trade.symbol))["result"]["list"]
        last_position = next((row for row in rows if row.get("symbol") == trade.symbol and dec(row.get("size")) > 0), None)
        remote = await find_order(client, entry_order.order_link_id, trade.symbol)
        status = remote.get("orderStatus") if remote else entry_order.status
        if status in {"Filled", "Rejected", "Cancelled", "Deactivated"}:
            return last_position
        if order_fully_filled(entry_order):
            return last_position
        await asyncio.sleep(1)

    # Market orders normally finish as IOC, but never assume the unfilled
    # remainder disappeared. Cancel an unexpectedly active remainder and
    # confirm its terminal state before protection is calculated.
    remote = await find_order(client, entry_order.order_link_id, trade.symbol)
    if remote and remote.get("orderStatus") in ACTIVE_REMOTE_ORDER_STATES:
        try:
            await client.cancel_order(trade.symbol, remote.get("orderId"), entry_order.order_link_id)
            cancel_deadline = asyncio.get_running_loop().time() + 5
            while asyncio.get_running_loop().time() < cancel_deadline:
                after = await find_order(client, entry_order.order_link_id, trade.symbol)
                if after and after.get("orderStatus") not in ACTIVE_REMOTE_ORDER_STATES:
                    entry_order.status = after.get("orderStatus") or "CANCELLED"
                    break
                await asyncio.sleep(0.5)
            else:
                entry_order.status = "CANCEL_UNKNOWN"
        except Exception:
            entry_order.status = "CANCEL_UNKNOWN"
        db.commit()

    await sync_order_executions(db, client, trade, entry_order)
    rows = (await client.positions(trade.symbol))["result"]["list"]
    return next((row for row in rows if row.get("symbol") == trade.symbol and dec(row.get("size")) > 0), last_position)


async def verify_conditional_order(
    client: BybitClient,
    symbol: str,
    order_link_id: str,
    expected_qty: D,
    expected_trigger: D,
    tick: D,
    timeout: int = 10,
) -> dict | None:
    deadline = asyncio.get_running_loop().time() + timeout
    while asyncio.get_running_loop().time() < deadline:
        order = await find_order(client, order_link_id, symbol)
        if order:
            status = order.get("orderStatus")
            qty = dec(order.get("qty"))
            trigger = dec(order.get("triggerPrice"))
            if status in {"New", "Untriggered", "PartiallyFilled"} and abs(qty - expected_qty) < D("0.0000000001") and abs(trigger - expected_trigger) <= tick:
                return order
        await asyncio.sleep(1)
    return None


async def place_conditional_record(
    db: Session,
    client: BybitClient,
    trade: Trade,
    purpose: str,
    qty: D,
    trigger_price: D,
    order_link_id: str | None = None,
) -> OrderRecord:
    side = "Sell" if trade.side == "LONG" else "Buy"
    trigger_direction = 2 if (purpose == "SL" and trade.side == "LONG") or (purpose != "SL" and trade.side == "SHORT") else 1
    link = order_link_id or make_link(purpose.lower(), trade.id)
    record = OrderRecord(
        trade_id=trade.id,
        order_link_id=link,
        purpose=purpose,
        side=side,
        requested_qty=qty,
        trigger_price=trigger_price,
        reduce_only=True,
        status="SUBMITTING",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    ack = await client.place_conditional_market(trade.symbol, side, qty, trigger_price, trigger_direction, link)
    record.exchange_order_id = ack.get("result", {}).get("orderId")
    record.status = "ACCEPTED"
    db.commit()
    return record


async def active_protection_orders(db: Session, trade_id: int, purpose: str | None = None) -> list[OrderRecord]:
    query = select(OrderRecord).where(
        OrderRecord.trade_id == trade_id,
        OrderRecord.status.not_in(["Filled", "Cancelled", "Rejected", "Deactivated", "FILLED", "CANCELLED"]),
    )
    if purpose:
        query = query.where(OrderRecord.purpose == purpose)
    return list(db.scalars(query).all())


ACTIVE_REMOTE_ORDER_STATES = {"New", "Untriggered", "PartiallyFilled"}


def order_fully_filled(order: OrderRecord) -> bool:
    """Return True only after the intended reduce-only quantity has executed.

    A touch of the trigger price or a small partial execution must not advance the
    trade-management state machine.
    """

    requested = dec(order.requested_qty)
    executed = dec(order.executed_qty)
    return order.status in {"Filled", "FILLED"} or (
        requested > 0 and executed >= requested - D("0.0000000001")
    )


async def cancel_unverified_order(
    db: Session,
    client: BybitClient,
    trade: Trade,
    order: OrderRecord,
    reason: str,
) -> bool:
    """Cancel an order that could not be verified before any retry.

    Returning False means cancellation could not be confirmed; callers must not
    create another order with the same purpose because that could leave duplicate
    exchange-side protection.
    """

    try:
        await client.cancel_order(trade.symbol, order.exchange_order_id, order.order_link_id)
        deadline = asyncio.get_running_loop().time() + 5
        while asyncio.get_running_loop().time() < deadline:
            remote_after_cancel = await find_order(client, order.order_link_id, trade.symbol)
            if remote_after_cancel and remote_after_cancel.get("orderStatus") not in ACTIVE_REMOTE_ORDER_STATES:
                order.status = remote_after_cancel.get("orderStatus") or "CANCELLED"
                db.commit()
                audit(
                    db,
                    "UNVERIFIED_ORDER_CANCELLED",
                    "trade",
                    trade.id,
                    {"purpose": order.purpose, "reason": reason, "status": order.status},
                )
                return True
            await asyncio.sleep(0.5)

        order.status = "CANCEL_UNKNOWN"
        db.commit()
        audit(
            db,
            "UNVERIFIED_ORDER_CANCEL_NOT_CONFIRMED",
            "trade",
            trade.id,
            {"purpose": order.purpose, "reason": reason},
        )
        return False
    except Exception as exc:
        remote = await find_order(client, order.order_link_id, trade.symbol)
        if remote and remote.get("orderStatus") in ACTIVE_REMOTE_ORDER_STATES:
            order.status = remote.get("orderStatus") or "New"
            order.exchange_order_id = remote.get("orderId") or order.exchange_order_id
            db.commit()
            audit(
                db,
                "UNVERIFIED_ORDER_STILL_ACTIVE",
                "trade",
                trade.id,
                {"purpose": order.purpose, "reason": reason, "error": str(exc)},
            )
            return False
        order.status = "CANCEL_UNKNOWN"
        db.commit()
        audit(
            db,
            "UNVERIFIED_ORDER_CANCEL_UNKNOWN",
            "trade",
            trade.id,
            {"purpose": order.purpose, "reason": reason, "error": str(exc)},
        )
        return False


async def verified_remote_order(
    client: BybitClient,
    trade: Trade,
    order: OrderRecord | None,
) -> dict | None:
    if order is None:
        return None
    remote = await find_order(client, order.order_link_id, trade.symbol)
    if remote and remote.get("orderStatus") in ACTIVE_REMOTE_ORDER_STATES:
        return remote
    return None


async def replace_stop(db: Session, client: BybitClient, trade: Trade, new_stop: D, tick: D, reason: str) -> bool:
    remaining = dec(trade.remaining_qty)
    if remaining <= 0:
        return False
    new_record = await place_conditional_record(db, client, trade, "SL", remaining, new_stop)
    verified = await verify_conditional_order(client, trade.symbol, new_record.order_link_id, remaining, new_stop, tick)
    if not verified:
        new_record.status = "VERIFY_FAILED"
        db.commit()
        await cancel_unverified_order(db, client, trade, new_record, f"{reason}_STOP_VERIFICATION_FAILED")
        return False
    new_record.status = verified.get("orderStatus") or "New"
    new_record.exchange_order_id = verified.get("orderId") or new_record.exchange_order_id
    db.commit()
    old_stops = [item for item in await active_protection_orders(db, trade.id, "SL") if item.id != new_record.id]
    for old in old_stops:
        try:
            await client.cancel_order(trade.symbol, old.exchange_order_id, old.order_link_id)
            old.status = "CANCELLED"
        except Exception as exc:
            audit(db, "OLD_STOP_CANCEL_FAILED", "trade", trade.id, {"order": old.order_link_id, "error": str(exc)})
    trade.current_stop = new_stop
    trade.last_sync = utcnow()
    db.commit()
    audit(db, "STOP_REPLACED", "trade", trade.id, {"reason": reason, "new_stop": str(new_stop)})
    return True


async def emergency_close(db: Session, client: BybitClient, trade: Trade, reason: str) -> None:
    remaining = dec(trade.remaining_qty)
    if remaining <= 0:
        return
    link = make_link("emg", trade.id)
    side = "Sell" if trade.side == "LONG" else "Buy"
    record = OrderRecord(
        trade_id=trade.id,
        order_link_id=link,
        purpose="EMERGENCY_CLOSE",
        side=side,
        requested_qty=remaining,
        reduce_only=True,
        status="SUBMITTING",
    )
    db.add(record)
    db.commit()
    ack = await client.place_market(trade.symbol, side, remaining, link, reduce_only=True)
    record.exchange_order_id = ack.get("result", {}).get("orderId")
    record.status = "ACCEPTED"
    db.commit()
    position = await wait_for_entry_fill(db, client, trade, record, timeout=10)
    rows = (await client.positions(trade.symbol))["result"]["list"]
    open_position = next((row for row in rows if dec(row.get("size")) > 0), None)
    if open_position is None:
        trade.state = "EMERGENCY_CLOSED_STOP_FAILURE"
        trade.remaining_qty = D("0")
        trade.closed_at = utcnow()
        trade.exit_reason = "EmergencyStopFailure"
    else:
        trade.state = "EMERGENCY_CLOSE_UNVERIFIED"
        trade.remaining_qty = dec(open_position.get("size"))
    config = get_config(db)
    config.global_entry_lock = True
    config.lock_reason = reason
    trade.protection_status = "UNPROTECTED"
    db.commit()
    audit(db, "EMERGENCY_CLOSE", "trade", trade.id, {"reason": reason, "position_still_open": open_position is not None})


async def place_and_verify_initial_protection(db: Session, client: BybitClient, trade: Trade, tick: D) -> bool:
    schedule = [0, 2, 5]
    stop_verified = False
    for delay in schedule:
        if delay:
            await asyncio.sleep(delay)
        try:
            stop_record = await place_conditional_record(db, client, trade, "SL", dec(trade.remaining_qty), dec(trade.current_stop))
            verified = await verify_conditional_order(
                client,
                trade.symbol,
                stop_record.order_link_id,
                dec(trade.remaining_qty),
                dec(trade.current_stop),
                tick,
            )
            if verified:
                stop_record.status = verified.get("orderStatus") or "New"
                stop_record.exchange_order_id = verified.get("orderId") or stop_record.exchange_order_id
                db.commit()
                stop_verified = True
                break
            stop_record.status = "VERIFY_FAILED"
            db.commit()
            if not await cancel_unverified_order(
                db,
                client,
                trade,
                stop_record,
                "INITIAL_STOP_VERIFICATION_FAILED",
            ):
                # Never submit a second stop while the first order's exchange
                # state is uncertain. Close the position instead.
                await emergency_close(db, client, trade, "STOP_ORDER_STATE_UNKNOWN")
                return False
        except Exception as exc:
            audit(db, "STOP_PROTECTION_RETRY", "trade", trade.id, {"delay": delay, "error": str(exc)})
    if not stop_verified:
        await emergency_close(db, client, trade, "STOP_VERIFICATION_FAILED")
        return False

    tp_results: dict[str, bool] = {"TP1": False, "TP2": dec(trade.tp2_qty) <= 0}
    for purpose, qty, price in (
        ("TP1", dec(trade.tp1_qty), dec(trade.tp1)),
        ("TP2", dec(trade.tp2_qty), dec(trade.tp2)),
    ):
        if qty <= 0:
            continue
        for delay in schedule:
            if delay:
                await asyncio.sleep(delay)
            try:
                record = await place_conditional_record(db, client, trade, purpose, qty, price)
                verified = await verify_conditional_order(client, trade.symbol, record.order_link_id, qty, price, tick)
                if verified:
                    record.status = verified.get("orderStatus") or "New"
                    record.exchange_order_id = verified.get("orderId") or record.exchange_order_id
                    db.commit()
                    tp_results[purpose] = True
                    break
                record.status = "VERIFY_FAILED"
                db.commit()
                if not await cancel_unverified_order(
                    db,
                    client,
                    trade,
                    record,
                    f"{purpose}_VERIFICATION_FAILED",
                ):
                    # The stop is already verified, so retain the position but
                    # do not create a possibly duplicated TP order.
                    audit(
                        db,
                        "TP_ORDER_STATE_UNKNOWN",
                        "trade",
                        trade.id,
                        {"purpose": purpose},
                    )
                    break
            except Exception as exc:
                audit(db, "TP_PROTECTION_RETRY", "trade", trade.id, {"purpose": purpose, "delay": delay, "error": str(exc)})

    if all(tp_results.values()):
        trade.protection_status = "PROTECTED"
        trade.state = "PROTECTED"
    else:
        trade.protection_status = "STOP_ONLY"
        trade.state = "PARTIALLY_PROTECTED"
        config = get_config(db)
        config.global_entry_lock = True
        config.lock_reason = "TP_PROTECTION_INCOMPLETE"
    db.commit()
    return True


def classify_full_risk_loss(net_pnl: D, initial_risk: D) -> bool:
    return net_pnl < 0 and abs(net_pnl) >= D("0.90") * initial_risk


def close_trade_accounting(db: Session, trade: Trade, net_pnl: D, exit_price: D | None = None, reason: str | None = None) -> None:
    if trade.closed_at is not None:
        return
    trade.realized_pnl = net_pnl
    trade.closed_at = utcnow()
    trade.state = "CLOSED"
    trade.remaining_qty = D("0")
    trade.exit_price = exit_price
    trade.exit_reason = reason or trade.exit_reason or "ExchangeClose"
    ledger = risk_ledger(db)
    ledger.realized_pnl = dec(ledger.realized_pnl) + net_pnl
    if classify_full_risk_loss(net_pnl, dec(trade.initial_risk_amount)):
        ledger.full_risk_losses += 1
    if ledger.full_risk_losses >= 4:
        ledger.locked = True
    start = trade.closed_at
    db.merge(
        Cooldown(
            symbol=trade.symbol,
            starts_at=start,
            ends_at=start + timedelta(hours=settings.cooldown_hours),
            trade_id=trade.id,
        )
    )
    db.commit()
    audit(db, "TRADE_CLOSED", "trade", trade.id, {"net_pnl": str(net_pnl), "full_risk_losses": ledger.full_risk_losses})


def trade_net_pnl(db: Session, trade_id: int) -> tuple[D, D | None]:
    rows = db.scalars(select(Execution).where(Execution.trade_id == trade_id).order_by(Execution.executed_at)).all()
    net = sum((dec(row.pnl) - dec(row.fee) for row in rows), D("0")).quantize(D("0.00000001"))
    trade = db.get(Trade, trade_id)
    closing_side = "Sell" if trade and trade.side == "LONG" else "Buy"
    exit_rows = [row for row in rows if row.side == closing_side and dec(row.qty) > 0]
    exit_price = exit_rows[-1].price if exit_rows else None
    return net, exit_price


async def execute_signal(db: Session, client: BybitClient, signal: Signal) -> Trade | None:
    config = get_config(db)
    ledger = risk_ledger(db)
    if config.scanner_state != "RUNNING" or config.global_entry_lock or ledger.locked:
        return None
    if db.scalar(select(Trade).where(Trade.symbol == signal.symbol, Trade.closed_at.is_(None))) is not None:
        signal.status = "REJECTED"
        signal.rejection_code = "REJECT_EXISTING_POSITION"
        db.commit()
        return None
    if db.scalar(select(func.count()).select_from(Trade).where(Trade.closed_at.is_(None))) >= settings.max_open_trades:
        signal.status = "REJECTED"
        signal.rejection_code = "REJECT_MAX_OPEN_TRADES"
        db.commit()
        return None
    cooldown = db.get(Cooldown, signal.symbol)
    if cooldown and as_utc(cooldown.ends_at) and as_utc(cooldown.ends_at) > utcnow():
        signal.status = "REJECTED"
        signal.rejection_code = "REJECT_SYMBOL_COOLDOWN"
        db.commit()
        return None

    spec = db.get(InstrumentSpec, signal.symbol)
    if spec is None:
        signal.status = "REJECTED"
        signal.rejection_code = "REJECT_INSTRUMENT_RULES_UNAVAILABLE"
        db.commit()
        return None

    total_equity, available_margin = await account_values(client)
    entry_reference = dec(signal.reference_price)
    risk_entry_reference = (
        entry_reference * D("1.003") if signal.direction == "LONG" else entry_reference * D("0.997")
    )
    stop = dec(signal.stop_price)
    qty_step = D(spec.qty_step)
    max_leverage = min(settings.max_leverage, int(dec(spec.max_leverage)))
    taker_fee = D(str(settings.taker_fee_rate_default))
    try:
        fee_rows = (await client.fee_rate(signal.symbol)).get("result", {}).get("list", [])
        dynamic_fee = dec(fee_rows[0].get("takerFeeRate")) if fee_rows else D("0")
        if dynamic_fee > 0:
            taker_fee = dynamic_fee
        else:
            raise ValueError("empty taker fee")
    except Exception as exc:
        audit(
            db,
            "FEE_RATE_FALLBACK_USED",
            "signal",
            signal.id,
            {"fallback": str(taker_fee), "error": str(exc)},
        )
    sized = size_position(
        dec(config.bot_trading_capital),
        total_equity,
        risk_entry_reference,
        stop,
        qty_step,
        available_margin,
        taker_fee=taker_fee,
        max_leverage=max_leverage,
    )
    if sized.reason:
        signal.status = "REJECTED"
        signal.rejection_code = sized.reason
        db.commit()
        return None

    try:
        await client.set_leverage(signal.symbol, sized.leverage)
        try:
            await client.set_auto_add_margin(signal.symbol, False)
        except BybitError as exc:
            if "not modified" not in str(exc).lower():
                audit(db, "AUTO_ADD_MARGIN_DISABLE_WARNING", "symbol", signal.symbol, {"error": str(exc)})
    except Exception as exc:
        signal.status = "REJECTED"
        signal.rejection_code = "REJECT_POSITION_CONFIGURATION"
        db.commit()
        audit(db, "POSITION_CONFIGURATION_FAILED", "signal", signal.id, {"error": str(exc)})
        return None

    link = make_link("entry")
    trade = Trade(
        signal_id=signal.id,
        symbol=signal.symbol,
        side=signal.direction,
        strategy=signal.matched_strategies,
        state="ENTRY_SUBMITTED",
        order_link_id=link,
        original_qty=sized.quantity,
        remaining_qty=D("0"),
        initial_stop=stop,
        current_stop=stop,
        leverage=sized.leverage,
        initial_risk_amount=sized.max_risk,
    )
    try:
        db.add(trade)
        db.commit()
        db.refresh(trade)
    except IntegrityError:
        db.rollback()
        signal.status = "REJECTED"
        signal.rejection_code = "REJECT_DUPLICATE_ACTIVE_SYMBOL"
        db.commit()
        return None

    side = "Buy" if signal.direction == "LONG" else "Sell"
    entry_order = OrderRecord(
        trade_id=trade.id,
        order_link_id=link,
        purpose="ENTRY",
        side=side,
        requested_qty=sized.quantity,
        reduce_only=False,
        status="SUBMITTING",
    )
    db.add(entry_order)
    db.commit()
    try:
        ack = await client.place_market(signal.symbol, side, sized.quantity, link, slippage="0.30")
        entry_order.exchange_order_id = ack.get("result", {}).get("orderId")
        entry_order.status = "ACCEPTED"
        trade.exchange_order_id = entry_order.exchange_order_id
        db.commit()
    except Exception as exc:
        entry_order.status = "UNKNOWN"
        trade.state = "RECONCILIATION_REQUIRED"
        db.commit()
        remote = await find_order(client, link, signal.symbol)
        if remote is None:
            entry_order.status = "REJECTED"
            trade.state = "ENTRY_REJECTED"
            trade.closed_at = utcnow()
            signal.status = "REJECTED"
            signal.rejection_code = "ENTRY_SUBMISSION_FAILED"
            db.commit()
            audit(db, "ENTRY_SUBMISSION_FAILED", "trade", trade.id, {"error": str(exc)})
            return trade

    position = await wait_for_entry_fill(db, client, trade, entry_order, timeout=10)
    await sync_order_executions(db, client, trade, entry_order)
    actual_qty = dec(entry_order.executed_qty)
    actual_entry = dec(entry_order.avg_price)
    if position:
        actual_qty = max(actual_qty, dec(position.get("size")))
        if actual_entry <= 0:
            actual_entry = dec(position.get("avgPrice"))
    if actual_qty <= 0 or actual_entry <= 0:
        if entry_order.status == "CANCEL_UNKNOWN":
            trade.state = "RECONCILIATION_REQUIRED"
            signal.status = "UNKNOWN"
            config.global_entry_lock = True
            config.lock_reason = "ENTRY_ORDER_STATE_UNKNOWN"
            db.commit()
            audit(db, "ENTRY_ORDER_STATE_UNKNOWN", "trade", trade.id)
            return trade
        trade.state = "ENTRY_UNFILLED"
        trade.closed_at = utcnow()
        signal.status = "UNFILLED"
        db.commit()
        return trade

    trade.original_qty = actual_qty
    trade.remaining_qty = actual_qty
    trade.avg_entry = actual_entry
    trade.opened_at = utcnow()
    if actual_qty < dec(entry_order.requested_qty):
        fill_ratio = actual_qty / dec(entry_order.requested_qty) if dec(entry_order.requested_qty) > 0 else D("0")
        trade.state = "PARTIAL_ENTRY_ACCEPTED_FOR_SAFETY"
        audit(
            db,
            "ENTRY_PARTIAL_FILL",
            "trade",
            trade.id,
            {"filled_qty": str(actual_qty), "requested_qty": str(entry_order.requested_qty), "fill_ratio": str(fill_ratio)},
        )
    if stop_distance_valid(actual_entry, stop):
        db.commit()
        await emergency_close(db, client, trade, stop_distance_valid(actual_entry, stop) or "INVALID_STOP")
        return trade

    max_qty = max_compliant_quantity(sized.max_risk, actual_entry, stop, qty_step, taker_fee=taker_fee)
    if actual_qty > max_qty:
        excess = floor_step(actual_qty - max_qty, qty_step)
        if excess > 0:
            correction_link = make_link("risk", trade.id)
            correction = OrderRecord(
                trade_id=trade.id,
                order_link_id=correction_link,
                purpose="RISK_CORRECTION",
                side="Sell" if trade.side == "LONG" else "Buy",
                requested_qty=excess,
                reduce_only=True,
                status="SUBMITTING",
            )
            db.add(correction)
            db.commit()
            ack = await client.place_market(trade.symbol, correction.side, excess, correction_link, reduce_only=True)
            correction.exchange_order_id = ack.get("result", {}).get("orderId")
            correction.status = "ACCEPTED"
            db.commit()
            await sync_order_executions(db, client, trade, correction)
            actual_qty = max_qty
            trade.original_qty = actual_qty
            trade.remaining_qty = actual_qty
            audit(db, "ENTRY_SLIPPAGE_RISK_CORRECTION", "trade", trade.id, {"reduced_qty": str(excess)})
    if actual_qty <= 0:
        await emergency_close(db, client, trade, "NO_COMPLIANT_QUANTITY")
        return trade

    tick = D(spec.tick_size)
    risk_distance = abs(actual_entry - stop)
    tp1_raw = actual_entry + risk_distance * D(2) if trade.side == "LONG" else actual_entry - risk_distance * D(2)
    tp2_raw = actual_entry + risk_distance * D(3) if trade.side == "LONG" else actual_entry - risk_distance * D(3)
    tp1 = floor_step(tp1_raw, tick) if trade.side == "LONG" else ceil_step(tp1_raw, tick)
    tp2 = floor_step(tp2_raw, tick) if trade.side == "LONG" else ceil_step(tp2_raw, tick)
    try:
        tp1_qty, tp2_qty, runner_qty = split_quantity(actual_qty, qty_step, D(spec.min_qty), D(spec.min_notional), tp2)
    except ValueError as exc:
        await emergency_close(db, client, trade, str(exc))
        return trade

    trade.tp1 = tp1
    trade.tp2 = tp2
    trade.tp1_qty = tp1_qty
    trade.tp2_qty = tp2_qty
    trade.runner_qty = runner_qty
    signal.tp1_price = tp1
    signal.tp2_price = tp2
    signal.status = "EXECUTED"
    db.commit()
    await place_and_verify_initial_protection(db, client, trade, tick)
    return trade


async def create_setups(db: Session, symbol: str, direction: str, candles_1h: list[Candle], ema20: D, ema50: D, tick: D) -> None:
    result = evaluate_1h(candles_1h, direction, ema20, ema50, tick)
    for setup in result.setups:
        exists = db.scalar(
            select(StrategySetup).where(
                StrategySetup.symbol == symbol,
                StrategySetup.strategy == setup.strategy,
                StrategySetup.direction == setup.direction,
                StrategySetup.setup_close_ms == setup.setup_close,
            )
        )
        if exists is None:
            db.add(
                StrategySetup(
                    symbol=symbol,
                    strategy=setup.strategy,
                    direction=setup.direction,
                    setup_close_ms=setup.setup_close,
                    reference_price=setup.reference,
                    extreme_price=setup.extreme,
                    expiry_candles=setup.expiry_candles,
                )
            )
    db.commit()


async def scan_symbol(db: Session, client: BybitClient, symbol: str) -> Signal | None:
    spec = db.get(InstrumentSpec, symbol)
    if spec is None:
        return None
    tick = D(spec.tick_size)
    candles_1h = closed_klines((await client.klines(symbol, "60", 200))["result"]["list"], 60)
    candles_15m = closed_klines((await client.klines(symbol, "15", 200))["result"]["list"], 15)
    if len(candles_1h) < 100 or len(candles_15m) < 25:
        return None
    ema20 = ema([item.close for item in candles_1h], 20)
    ema50 = ema([item.close for item in candles_1h], 50)
    direction = trend(ema20, ema50, tick)

    universe = db.get(UniverseSymbol, symbol)
    if universe:
        universe.last_trend = direction
        universe.last_scanned_at = utcnow()
        ticker = (await client.tickers(symbol))["result"]["list"]
        if ticker:
            universe.last_price = dec(ticker[0].get("lastPrice"))
            universe.price_change_pct = dec(ticker[0].get("price24hPcnt")) * D("100")
    config = get_config(db)
    config.last_scan_at = utcnow()
    db.commit()

    if direction == "NEUTRAL":
        return None
    await create_setups(db, symbol, direction, candles_1h, ema20, ema50, tick)

    current = candles_15m[-1]
    previous = candles_15m[-2]
    confirmations = confirmation_types(candles_15m, direction, tick)
    active = db.scalars(
        select(StrategySetup).where(
            StrategySetup.symbol == symbol,
            StrategySetup.status == "ACTIVE",
        )
    ).all()
    matched: list[StrategySetup] = []
    for setup in active:
        if setup.direction != direction:
            setup.status = "INVALIDATED"
            setup.rejection_code = "TREND_DIRECTION_CHANGED"
            continue
        age = (current.close_time - setup.setup_close_ms) // 900_000
        if age < 1:
            continue
        if age > setup.expiry_candles:
            setup.status = "EXPIRED"
            setup.rejection_code = "SETUP_EXPIRED"
            continue
        if setup_invalidated(
            setup.strategy,
            setup.direction,
            dec(setup.reference_price),
            dec(setup.extreme_price),
            current,
            tick,
        ):
            setup.status = "INVALIDATED"
            setup.rejection_code = "SETUP_INVALIDATED"
            continue
        if setup.strategy == "BREAKOUT_RETEST" and breakout_retest_seen(direction, dec(setup.reference_price), current):
            setup.retest_seen = True
        if confirmation_matches_setup(
            setup.strategy,
            direction,
            dec(setup.reference_price),
            confirmations,
            previous,
            current,
            setup.retest_seen,
            tick,
        ):
            matched.append(setup)
    db.commit()
    if not matched or not confirmations:
        return None

    canonical_setup_close = min(item.setup_close_ms for item in matched)
    signal_fingerprint = fingerprint(symbol, direction, canonical_setup_close, current.close_time)
    if db.scalar(select(Signal).where(Signal.fingerprint == signal_fingerprint)):
        return None
    swing = latest_swing(candles_15m[:-1], "low" if direction == "LONG" else "high", 20)
    if swing is None:
        return None
    swing_price = swing[1].low if direction == "LONG" else swing[1].high
    offset = max(tick * 2, swing_price * D("0.0005"))
    stop = floor_step(swing_price - offset, tick) if direction == "LONG" else ceil_step(swing_price + offset, tick)
    rejection = stop_distance_valid(current.close, stop)
    if rejection:
        return None

    strategies = sorted({item.strategy for item in matched})
    risk_distance = abs(current.close - stop)
    tp1 = floor_step(current.close + risk_distance * D(2), tick) if direction == "LONG" else ceil_step(current.close - risk_distance * D(2), tick)
    tp2 = floor_step(current.close + risk_distance * D(3), tick) if direction == "LONG" else ceil_step(current.close - risk_distance * D(3), tick)
    signal = Signal(
        fingerprint=signal_fingerprint,
        symbol=symbol,
        direction=direction,
        matched_strategies=json.dumps(strategies),
        confirmation=json.dumps(confirmations),
        setup_close_ms=canonical_setup_close,
        confirmation_close_ms=current.close_time,
        reference_price=current.close,
        stop_price=stop,
        tp1_price=tp1,
        tp2_price=tp2,
        status="CREATED",
    )
    db.add(signal)
    db.commit()
    db.refresh(signal)
    for setup in matched:
        setup.status = "CONSUMED"
        setup.consumed_signal_id = signal.id
    if universe:
        universe.last_strategy = ", ".join(strategies)
    db.commit()
    audit(db, "SIGNAL_CREATED", "signal", signal.id, {"symbol": symbol, "strategies": strategies})
    await execute_signal(db, client, signal)
    return signal


async def scanner_loop(session_factory) -> None:
    client = BybitClient()
    try:
        while True:
            with session_factory() as db:
                config = get_config(db)
                if config.scanner_state != "RUNNING":
                    break
                if universe_is_stale(db):
                    await refresh_universe(db, client)
                symbols = [row.symbol for row in db.scalars(select(UniverseSymbol).order_by(UniverseSymbol.rank)).all()]
                for symbol in symbols:
                    if get_config(db).scanner_state != "RUNNING":
                        break
                    try:
                        await scan_symbol(db, client, symbol)
                    except Exception as exc:
                        audit(db, "SCAN_SYMBOL_ERROR", "symbol", symbol, {"error": str(exc)})
                    await asyncio.sleep(0.12)
            await asyncio.sleep(settings.scan_interval_seconds)
    finally:
        await client.close()


async def cancel_orphan_protection(db: Session, client: BybitClient, trade: Trade) -> None:
    orders = await active_protection_orders(db, trade.id)
    for order in orders:
        if order.purpose not in {"SL", "TP1", "TP2"}:
            continue
        try:
            await client.cancel_order(trade.symbol, order.exchange_order_id, order.order_link_id)
            order.status = "CANCELLED"
        except Exception:
            pass
    db.commit()


async def ensure_protection_reconciled(
    db: Session,
    client: BybitClient,
    trade: Trade,
) -> list[str]:
    """Verify the exchange-side protection expected for the current trade stage.

    REST order state is authoritative. A missing stop is restored once and, if
    restoration cannot be verified, the position is emergency-closed. Missing
    take-profit orders retain the effective stop but activate the global entry
    lock for operator/retry handling.
    """

    spec = db.get(InstrumentSpec, trade.symbol)
    if spec is None:
        return ["INSTRUMENT_SPEC_MISSING"]
    tick = D(spec.tick_size)

    rows = db.scalars(
        select(OrderRecord)
        .where(OrderRecord.trade_id == trade.id, OrderRecord.purpose.in_(["SL", "TP1", "TP2"]))
        .order_by(OrderRecord.id.desc())
    ).all()

    async def active_for(purpose: str) -> tuple[OrderRecord | None, dict | None]:
        for candidate in rows:
            if candidate.purpose != purpose:
                continue
            remote_candidate = await verified_remote_order(client, trade, candidate)
            if remote_candidate:
                return candidate, remote_candidate
        return None, None

    missing: list[str] = []
    stop_order, stop_remote = await active_for("SL")
    if stop_remote:
        remote_qty = dec(stop_remote.get("qty"))
        remote_trigger = dec(stop_remote.get("triggerPrice"))
        if remote_qty + D("0.0000000001") < dec(trade.remaining_qty):
            missing.append("SL_QUANTITY_MISMATCH")
        if abs(remote_trigger - dec(trade.current_stop)) > tick:
            missing.append("SL_TRIGGER_MISMATCH")
    else:
        missing.append("SL_MISSING")

    if any(item.startswith("SL_") for item in missing):
        restored = await replace_stop(
            db,
            client,
            trade,
            dec(trade.current_stop),
            tick,
            "RECONCILIATION_STOP_RESTORE",
        )
        if not restored:
            await emergency_close(db, client, trade, "RECONCILIATION_STOP_UNAVAILABLE")
            return missing + ["EMERGENCY_CLOSE_REQUIRED"]
        missing = [item for item in missing if not item.startswith("SL_")]

    expected_tps: list[tuple[str, D, D]] = []
    if not trade.tp1_hit and dec(trade.tp1_qty) > 0:
        expected_tps.append(("TP1", dec(trade.tp1_qty), dec(trade.tp1)))
    if not trade.tp2_hit and dec(trade.tp2_qty) > 0:
        expected_tps.append(("TP2", dec(trade.tp2_qty), dec(trade.tp2)))

    for purpose, expected_qty, expected_trigger in expected_tps:
        record, remote = await active_for(purpose)
        if remote is None:
            missing.append(f"{purpose}_MISSING")
            continue
        if abs(dec(remote.get("qty")) - expected_qty) > D("0.0000000001"):
            missing.append(f"{purpose}_QUANTITY_MISMATCH")
        if abs(dec(remote.get("triggerPrice")) - expected_trigger) > tick:
            missing.append(f"{purpose}_TRIGGER_MISMATCH")

    config = get_config(db)
    if missing:
        trade.protection_status = "STOP_ONLY" if all(item.startswith("TP") for item in missing) else "PARTIAL"
        config.global_entry_lock = True
        config.lock_reason = "PROTECTION_RECONCILIATION_MISMATCH"
    else:
        trade.protection_status = "PROTECTED"
    db.commit()
    return missing


async def reconcile(db: Session, client: BybitClient) -> dict:
    run = ReconciliationRun(status="RUNNING")
    db.add(run)
    db.commit()
    mismatches = 0
    summary: dict[str, object] = {}
    try:
        positions = (await client.positions())["result"]["list"]
        active_positions = [item for item in positions if dec(item.get("size")) > 0]
        local_trades = db.scalars(select(Trade).where(Trade.closed_at.is_(None))).all()
        local_map = {trade.symbol: trade for trade in local_trades}
        exchange_map = {item["symbol"]: item for item in active_positions}
        config = get_config(db)

        for symbol, position in exchange_map.items():
            trade = local_map.get(symbol)
            if trade is None:
                mismatches += 1
                summary[symbol] = {"issue": "EXTERNAL_POSITION", "size": position.get("size"), "side": position.get("side")}
                config.global_entry_lock = True
                config.lock_reason = "EXTERNAL_POSITION_REVIEW_REQUIRED"
                continue
            expected_side = "Buy" if trade.side == "LONG" else "Sell"
            issues: list[str] = []
            if position.get("side") != expected_side:
                issues.append("SIDE_MISMATCH")
            if dec(position.get("size")) != dec(trade.remaining_qty):
                issues.append("QUANTITY_MISMATCH")
                trade.remaining_qty = dec(position.get("size"))
            if dec(position.get("avgPrice")) > 0 and dec(position.get("avgPrice")) != dec(trade.avg_entry):
                issues.append("ENTRY_PRICE_MISMATCH")
                trade.avg_entry = dec(position.get("avgPrice"))
            if int(dec(position.get("leverage"), "0")) > 5:
                issues.append("LEVERAGE_ABOVE_5X")
            if int(position.get("autoAddMargin") or 0) != 0:
                issues.append("AUTO_ADD_MARGIN_ENABLED")
            trade.unrealized_pnl = dec(position.get("unrealisedPnl"))
            trade.last_sync = utcnow()
            await update_order_statuses(db, client, trade)
            await sync_all_executions(db, client, trade)
            protection_issues = await ensure_protection_reconciled(db, client, trade)
            if protection_issues:
                issues.extend(protection_issues)
            if issues:
                mismatches += len(issues)
                summary[symbol] = {"issues": issues}
                config.global_entry_lock = True
                config.lock_reason = "RECONCILIATION_MISMATCH"

        for symbol, trade in local_map.items():
            if symbol not in exchange_map and trade.state not in {"ENTRY_PENDING", "ENTRY_SUBMITTED", "ENTRY_UNFILLED"}:
                await sync_all_executions(db, client, trade)
                net_pnl, exit_price = trade_net_pnl(db, trade.id)
                close_trade_accounting(db, trade, net_pnl, exit_price, trade.exit_reason or "ExchangeClose")
                await cancel_orphan_protection(db, client, trade)

        run.status = "COMPLETED"
        run.mismatches = mismatches
        run.summary = json.dumps(summary, default=str)
        run.completed_at = utcnow()
        runtime.last_reconciliation = run.completed_at
        db.commit()
    except Exception as exc:
        run.status = "FAILED"
        run.summary = json.dumps({"error": str(exc)})
        run.completed_at = utcnow()
        db.commit()
        raise
    return {"mismatches": mismatches, "summary": summary}


async def update_order_statuses(db: Session, client: BybitClient, trade: Trade) -> None:
    orders = db.scalars(select(OrderRecord).where(OrderRecord.trade_id == trade.id)).all()
    for order in orders:
        remote = await find_order(client, order.order_link_id, trade.symbol)
        if remote:
            order.status = remote.get("orderStatus") or order.status
            order.exchange_order_id = remote.get("orderId") or order.exchange_order_id
        await sync_order_executions(db, client, trade, order)
    db.commit()


async def manage_open_trades(db: Session, client: BybitClient) -> None:
    trades = db.scalars(select(Trade).where(Trade.closed_at.is_(None))).all()
    for trade in trades:
        rows = (await client.positions(trade.symbol))["result"]["list"]
        position = next((row for row in rows if row.get("symbol") == trade.symbol and dec(row.get("size")) > 0), None)
        await update_order_statuses(db, client, trade)
        if position is None:
            if trade.state not in {"ENTRY_PENDING", "ENTRY_SUBMITTED"}:
                net_pnl, exit_price = trade_net_pnl(db, trade.id)
                close_trade_accounting(db, trade, net_pnl, exit_price, trade.exit_reason or "ExchangeClose")
                await cancel_orphan_protection(db, client, trade)
            continue

        trade.remaining_qty = dec(position.get("size"))
        trade.avg_entry = dec(position.get("avgPrice")) or dec(trade.avg_entry)
        trade.unrealized_pnl = dec(position.get("unrealisedPnl"))
        trade.last_sync = utcnow()
        spec = db.get(InstrumentSpec, trade.symbol)
        if spec is None:
            continue
        tick = D(spec.tick_size)
        tp1_order = db.scalar(select(OrderRecord).where(OrderRecord.trade_id == trade.id, OrderRecord.purpose == "TP1").order_by(OrderRecord.id.desc()))
        tp2_order = db.scalar(select(OrderRecord).where(OrderRecord.trade_id == trade.id, OrderRecord.purpose == "TP2").order_by(OrderRecord.id.desc()))

        if tp1_order and order_fully_filled(tp1_order) and not trade.tp1_hit:
            trade.tp1_hit = True
            trade.state = "BREAKEVEN_PENDING"
            db.commit()
            success = await replace_stop(db, client, trade, dec(trade.avg_entry), tick, "TP1_BREAKEVEN")
            if success:
                trade.state = "BREAKEVEN_ACTIVE"
            else:
                active_stops = await active_protection_orders(db, trade.id, "SL")
                if not active_stops:
                    await emergency_close(db, client, trade, "BREAKEVEN_STOP_UNAVAILABLE")
                else:
                    config = get_config(db)
                    config.global_entry_lock = True
                    config.lock_reason = "BREAKEVEN_VERIFICATION_FAILED"
            db.commit()

        if tp2_order and order_fully_filled(tp2_order) and not trade.tp2_hit:
            trade.tp2_hit = True
            trade.state = "TRAILING_ACTIVE" if dec(trade.runner_qty) > 0 else "CLOSE_PENDING"
            db.commit()

        if trade.state == "TRAILING_ACTIVE" and dec(trade.remaining_qty) > 0:
            candles = closed_klines((await client.klines(trade.symbol, "15", 80))["result"]["list"], 15)
            if trade.side == "LONG":
                swings = [(index, candles[index]) for index in range(2, len(candles) - 2) if __import__("backend.app.strategy", fromlist=["swing_low"]).swing_low(candles, index)]
                if len(swings) >= 2 and swings[-1][1].low > swings[-2][1].low + tick:
                    swing = swings[-1][1].low
                    candidate = floor_step(swing - max(tick * 2, swing * D("0.0005")), tick)
                    if candidate > dec(trade.current_stop) and candidate < dec(position.get("markPrice"), str(candidate + tick)):
                        if not await replace_stop(db, client, trade, candidate, tick, "TRAILING_HIGHER_LOW"):
                            config = get_config(db)
                            config.global_entry_lock = True
                            config.lock_reason = "TRAILING_UPDATE_FAILED"
            else:
                swings = [(index, candles[index]) for index in range(2, len(candles) - 2) if __import__("backend.app.strategy", fromlist=["swing_high"]).swing_high(candles, index)]
                if len(swings) >= 2 and swings[-1][1].high < swings[-2][1].high - tick:
                    swing = swings[-1][1].high
                    candidate = ceil_step(swing + max(tick * 2, swing * D("0.0005")), tick)
                    if (dec(trade.current_stop) == 0 or candidate < dec(trade.current_stop)) and candidate > dec(position.get("markPrice"), str(candidate - tick)):
                        if not await replace_stop(db, client, trade, candidate, tick, "TRAILING_LOWER_HIGH"):
                            config = get_config(db)
                            config.global_entry_lock = True
                            config.lock_reason = "TRAILING_UPDATE_FAILED"
        db.commit()


async def manager_loop(session_factory) -> None:
    client = BybitClient()
    try:
        while True:
            await asyncio.sleep(settings.reconciliation_interval_seconds)
            if not settings.bybit_api_key or not settings.bybit_api_secret:
                continue
            with session_factory() as db:
                try:
                    await reconcile(db, client)
                    await manage_open_trades(db, client)
                    runtime.private_ok = True
                except Exception as exc:
                    runtime.last_error = str(exc)
                    audit(db, "POSITION_MANAGEMENT_FAILED", detail={"error": str(exc)})
    finally:
        await client.close()


async def start_scanner(db: Session, session_factory) -> dict:
    config = get_config(db)
    if config.scanner_state == "RUNNING":
        return {"state": "RUNNING"}
    config.scanner_state = "STARTING"
    db.commit()
    client = BybitClient()
    try:
        checks = await health_checks(db, client)
        config = get_config(db)
        if config.global_entry_lock:
            raise RuntimeError(config.lock_reason or "GLOBAL_ENTRY_LOCK")
        if risk_ledger(db).locked:
            raise RuntimeError("DAILY_FULL_RISK_LOSS_LOCK")
        if universe_is_stale(db):
            await refresh_universe(db, client)
        config.scanner_state = "RUNNING"
        db.commit()
        audit(db, "SCANNER_STARTED", detail=checks)
        if runtime.scanner_task is None or runtime.scanner_task.done():
            runtime.scanner_task = asyncio.create_task(scanner_loop(session_factory))
        return {"state": "RUNNING"}
    except Exception as exc:
        config.scanner_state = "START_FAILED"
        db.commit()
        audit(db, "SCANNER_START_FAILED", detail={"error": str(exc)})
        raise
    finally:
        await client.close()


def stop_scanner(db: Session) -> dict:
    config = get_config(db)
    config.scanner_state = "STOPPED"
    db.commit()
    audit(db, "SCANNER_STOPPED")
    return {"state": "STOPPED"}


async def close_trade_manually(db: Session, client: BybitClient, trade: Trade) -> Trade:
    if trade.closed_at is not None:
        return trade
    remaining = dec(trade.remaining_qty)
    if remaining <= 0:
        return trade
    link = make_link("manual", trade.id)
    side = "Sell" if trade.side == "LONG" else "Buy"
    record = OrderRecord(
        trade_id=trade.id,
        order_link_id=link,
        purpose="MANUAL_CLOSE",
        side=side,
        requested_qty=remaining,
        reduce_only=True,
        status="SUBMITTING",
    )
    db.add(record)
    db.commit()
    ack = await client.place_market(trade.symbol, side, remaining, link, reduce_only=True)
    record.exchange_order_id = ack.get("result", {}).get("orderId")
    record.status = "ACCEPTED"
    trade.exit_reason = "Manual"
    db.commit()
    await asyncio.sleep(1)
    await sync_order_executions(db, client, trade, record)
    await reconcile(db, client)
    return trade
