from datetime import datetime, timezone
from decimal import Decimal as D
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError

from app.database import Base, SessionLocal, engine
from app.domain import Candle
from app.models import Execution, OrderRecord, Trade
from app.services import as_utc, order_fully_filled, trade_net_pnl
from app.strategy import confirmation_matches_setup


def candle(o, h, l, c, t=0):
    return Candle(t, t + 900000, D(str(o)), D(str(h)), D(str(l)), D(str(c)))


def test_sqlite_datetime_is_normalized_to_utc():
    naive = datetime(2026, 6, 21, 12, 0, 0)
    aware = as_utc(naive)
    assert aware is not None and aware.tzinfo == timezone.utc


def test_one_active_trade_per_symbol_database_constraint():
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        db.query(Trade).delete()
        db.commit()
        first = Trade(symbol="BTCUSDT", side="LONG", order_link_id="test-active-1")
        db.add(first)
        db.commit()
        db.add(Trade(symbol="BTCUSDT", side="SHORT", order_link_id="test-active-2"))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()
        first.closed_at = datetime.now(timezone.utc)
        db.commit()
        db.add(Trade(symbol="BTCUSDT", side="SHORT", order_link_id="test-active-3"))
        db.commit()
        db.query(Trade).delete()
        db.commit()


def test_price_action_midpoint_is_enforced():
    previous = candle(100, 101, 99, 100)
    current = candle(100, 101, 99, 100.4)
    assert confirmation_matches_setup(
        "PRICE_ACTION", "LONG", D("100.5"), ["BULLISH_REJECTION"], previous, current, False, D("0.1")
    ) is False


def test_breakout_requires_retest_seen():
    previous = candle(99, 100, 98, 99.5)
    current = candle(100, 102, 99.5, 101.5)
    assert not confirmation_matches_setup(
        "BREAKOUT_RETEST", "LONG", D("100"), ["LOCAL_STRUCTURE_BREAK"], previous, current, False, D("0.1")
    )
    assert confirmation_matches_setup(
        "BREAKOUT_RETEST", "LONG", D("100"), ["LOCAL_STRUCTURE_BREAK"], previous, current, True, D("0.1")
    )


def test_tp_stage_requires_full_requested_quantity():
    order = OrderRecord(
        trade_id=1,
        order_link_id="test-tp-fill",
        purpose="TP1",
        side="Sell",
        requested_qty=D("1.0"),
        executed_qty=D("0.5"),
        reduce_only=True,
        status="PartiallyFilled",
    )
    assert order_fully_filled(order) is False
    order.executed_qty = D("1.0")
    assert order_fully_filled(order) is True


def test_short_trade_exit_price_uses_buy_execution():
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        db.query(Execution).filter(Execution.exec_id.like("audit-short-%")).delete(synchronize_session=False)
        db.query(Trade).filter(Trade.symbol.like("AUDIT%USDT")).delete(synchronize_session=False)
        db.commit()
        suffix = uuid4().hex
        trade = Trade(
            symbol=f"AUDIT{suffix[:8]}USDT",
            side="SHORT",
            order_link_id=f"audit-short-{suffix}"[:36],
            closed_at=datetime.now(timezone.utc),
        )
        db.add(trade)
        db.commit()
        db.refresh(trade)
        db.add_all(
            [
                Execution(
                    exec_id=f"audit-short-sell-{suffix}",
                    trade_id=trade.id,
                    order_id="entry",
                    side="Sell",
                    price=D("100"),
                    qty=D("1"),
                    fee=D("0.05"),
                    pnl=D("0"),
                ),
                Execution(
                    exec_id=f"audit-short-buy-{suffix}",
                    trade_id=trade.id,
                    order_id="exit",
                    side="Buy",
                    price=D("90"),
                    qty=D("1"),
                    fee=D("0.05"),
                    pnl=D("10"),
                ),
            ]
        )
        db.commit()
        net, exit_price = trade_net_pnl(db, trade.id)
        assert net == D("9.90")
        assert exit_price == D("90")
        db.query(Execution).filter(Execution.trade_id == trade.id).delete()
        db.delete(trade)
        db.commit()
