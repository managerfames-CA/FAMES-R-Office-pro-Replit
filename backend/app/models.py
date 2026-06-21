from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base

MONEY = Numeric(38, 18)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SystemConfig(Base):
    __tablename__ = "bbot_system_config"
    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    bot_trading_capital: Mapped[Decimal] = mapped_column(MONEY, default=Decimal("1000"))
    scanner_state: Mapped[str] = mapped_column(String(20), default="STOPPED")
    global_entry_lock: Mapped[bool] = mapped_column(Boolean, default=False)
    lock_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_scan_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class UniverseSymbol(Base):
    __tablename__ = "bbot_universe_symbols"
    symbol: Mapped[str] = mapped_column(String(30), primary_key=True)
    rank: Mapped[int] = mapped_column(Integer)
    turnover24h: Mapped[Decimal] = mapped_column(MONEY, default=0)
    volume24h: Mapped[Decimal] = mapped_column(MONEY, default=0)
    bid: Mapped[Decimal] = mapped_column(MONEY, default=0)
    ask: Mapped[Decimal] = mapped_column(MONEY, default=0)
    last_price: Mapped[Decimal] = mapped_column(MONEY, default=0)
    price_change_pct: Mapped[Decimal] = mapped_column(MONEY, default=0)
    eligible: Mapped[bool] = mapped_column(Boolean, default=True)
    last_strategy: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_trend: Mapped[str | None] = mapped_column(String(10), nullable=True)
    last_scanned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    snapshot_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class InstrumentSpec(Base):
    __tablename__ = "bbot_instrument_specs"
    symbol: Mapped[str] = mapped_column(String(30), primary_key=True)
    tick_size: Mapped[str] = mapped_column(String(32))
    qty_step: Mapped[str] = mapped_column(String(32))
    min_qty: Mapped[str] = mapped_column(String(32))
    max_market_qty: Mapped[str] = mapped_column(String(32))
    min_notional: Mapped[str] = mapped_column(String(32), default="0")
    max_leverage: Mapped[str] = mapped_column(String(32), default="5")
    status: Mapped[str] = mapped_column(String(30), default="Trading")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class StrategySetup(Base):
    __tablename__ = "bbot_strategy_setups"
    id: Mapped[int] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column(String(30), index=True)
    strategy: Mapped[str] = mapped_column(String(60))
    direction: Mapped[str] = mapped_column(String(8))
    setup_close_ms: Mapped[int] = mapped_column(Integer)
    reference_price: Mapped[Decimal] = mapped_column(MONEY)
    extreme_price: Mapped[Decimal] = mapped_column(MONEY)
    expiry_candles: Mapped[int] = mapped_column(Integer, default=8)
    retest_seen: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")
    rejection_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    consumed_signal_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    __table_args__ = (
        UniqueConstraint("symbol", "strategy", "direction", "setup_close_ms", name="uq_bbot_setup_identity"),
    )


class Signal(Base):
    __tablename__ = "bbot_signals"
    id: Mapped[int] = mapped_column(primary_key=True)
    fingerprint: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    symbol: Mapped[str] = mapped_column(String(30), index=True)
    direction: Mapped[str] = mapped_column(String(8))
    matched_strategies: Mapped[str] = mapped_column(Text)
    confirmation: Mapped[str] = mapped_column(Text)
    setup_close_ms: Mapped[int] = mapped_column(Integer)
    confirmation_close_ms: Mapped[int] = mapped_column(Integer)
    reference_price: Mapped[Decimal] = mapped_column(MONEY)
    stop_price: Mapped[Decimal] = mapped_column(MONEY)
    tp1_price: Mapped[Decimal] = mapped_column(MONEY, default=0)
    tp2_price: Mapped[Decimal] = mapped_column(MONEY, default=0)
    status: Mapped[str] = mapped_column(String(30), default="CREATED")
    rejection_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Trade(Base):
    __tablename__ = "bbot_trades"
    id: Mapped[int] = mapped_column(primary_key=True)
    signal_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    symbol: Mapped[str] = mapped_column(String(30), index=True)
    side: Mapped[str] = mapped_column(String(8))
    strategy: Mapped[str] = mapped_column(String(255), default="")
    state: Mapped[str] = mapped_column(String(50), default="ENTRY_PENDING")
    order_link_id: Mapped[str] = mapped_column(String(36), unique=True)
    exchange_order_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    original_qty: Mapped[Decimal] = mapped_column(MONEY, default=0)
    remaining_qty: Mapped[Decimal] = mapped_column(MONEY, default=0)
    avg_entry: Mapped[Decimal] = mapped_column(MONEY, default=0)
    initial_stop: Mapped[Decimal] = mapped_column(MONEY, default=0)
    current_stop: Mapped[Decimal] = mapped_column(MONEY, default=0)
    tp1: Mapped[Decimal] = mapped_column(MONEY, default=0)
    tp2: Mapped[Decimal] = mapped_column(MONEY, default=0)
    tp1_qty: Mapped[Decimal] = mapped_column(MONEY, default=0)
    tp2_qty: Mapped[Decimal] = mapped_column(MONEY, default=0)
    runner_qty: Mapped[Decimal] = mapped_column(MONEY, default=0)
    leverage: Mapped[int] = mapped_column(Integer, default=1)
    initial_risk_amount: Mapped[Decimal] = mapped_column(MONEY, default=0)
    realized_pnl: Mapped[Decimal] = mapped_column(MONEY, default=0)
    unrealized_pnl: Mapped[Decimal] = mapped_column(MONEY, default=0)
    exit_price: Mapped[Decimal | None] = mapped_column(MONEY, nullable=True)
    exit_reason: Mapped[str | None] = mapped_column(String(50), nullable=True)
    protection_status: Mapped[str] = mapped_column(String(30), default="UNPROTECTED")
    tp1_hit: Mapped[bool] = mapped_column(Boolean, default=False)
    tp2_hit: Mapped[bool] = mapped_column(Boolean, default=False)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_sync: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (
        Index(
            "uq_bbot_one_active_trade_per_symbol",
            "symbol",
            unique=True,
            sqlite_where=text("closed_at IS NULL"),
            postgresql_where=text("closed_at IS NULL"),
        ),
    )


class OrderRecord(Base):
    __tablename__ = "bbot_orders"
    id: Mapped[int] = mapped_column(primary_key=True)
    trade_id: Mapped[int] = mapped_column(Integer, index=True)
    exchange_order_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    order_link_id: Mapped[str] = mapped_column(String(36), unique=True)
    purpose: Mapped[str] = mapped_column(String(20))
    side: Mapped[str] = mapped_column(String(8))
    requested_qty: Mapped[Decimal] = mapped_column(MONEY)
    executed_qty: Mapped[Decimal] = mapped_column(MONEY, default=0)
    avg_price: Mapped[Decimal] = mapped_column(MONEY, default=0)
    trigger_price: Mapped[Decimal | None] = mapped_column(MONEY, nullable=True)
    reduce_only: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(30), default="CREATED")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Execution(Base):
    __tablename__ = "bbot_executions"
    id: Mapped[int] = mapped_column(primary_key=True)
    exec_id: Mapped[str] = mapped_column(String(100), unique=True)
    trade_id: Mapped[int] = mapped_column(Integer, index=True)
    order_id: Mapped[str] = mapped_column(String(80))
    order_link_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    side: Mapped[str] = mapped_column(String(8), default="")
    price: Mapped[Decimal] = mapped_column(MONEY)
    qty: Mapped[Decimal] = mapped_column(MONEY)
    fee: Mapped[Decimal] = mapped_column(MONEY, default=0)
    pnl: Mapped[Decimal] = mapped_column(MONEY, default=0)
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Cooldown(Base):
    __tablename__ = "bbot_cooldowns"
    symbol: Mapped[str] = mapped_column(String(30), primary_key=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    trade_id: Mapped[int] = mapped_column(Integer)


class DailyRiskLedger(Base):
    __tablename__ = "bbot_daily_risk_ledger"
    trading_date: Mapped[str] = mapped_column(String(10), primary_key=True)
    full_risk_losses: Mapped[int] = mapped_column(Integer, default=0)
    realized_pnl: Mapped[Decimal] = mapped_column(MONEY, default=0)
    locked: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ReconciliationRun(Base):
    __tablename__ = "bbot_reconciliation_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    status: Mapped[str] = mapped_column(String(30))
    mismatches: Mapped[int] = mapped_column(Integer, default=0)
    summary: Mapped[str] = mapped_column(Text, default="{}")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AuditEvent(Base):
    __tablename__ = "bbot_audit_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    event_type: Mapped[str] = mapped_column(String(80), index=True)
    entity_type: Mapped[str] = mapped_column(String(40))
    entity_id: Mapped[str] = mapped_column(String(80))
    detail: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class JournalNote(Base):
    __tablename__ = "bbot_journal_notes"
    trade_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    review: Mapped[str | None] = mapped_column(Text, nullable=True)
    mistake_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
