from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal as D

from .domain import floor_step


@dataclass(frozen=True)
class SizeResult:
    quantity: D
    risk_basis: D
    max_risk: D
    leverage: int
    reason: str | None = None


def select_leverage(notional: D, available_margin: D, fee_reserve: D, max_leverage: int = 5) -> int | None:
    usable = available_margin - max(available_margin * D("0.05"), fee_reserve)
    for leverage in range(1, max_leverage + 1):
        if notional / D(leverage) <= usable:
            return leverage
    return None


def size_position(
    bot_capital: D,
    usable_equity: D,
    entry: D,
    stop: D,
    qty_step: D,
    available_margin: D,
    taker_fee: D = D("0.0006"),
    max_leverage: int = 5,
) -> SizeResult:
    basis = min(bot_capital, usable_equity)
    max_risk = basis * D("0.01")
    distance = abs(entry - stop)
    if distance <= 0:
        return SizeResult(D("0"), basis, max_risk, 0, "REJECT_STOP_INVALID_SIDE")
    per_unit = distance + (entry + stop) * taker_fee
    quantity = floor_step(max_risk / per_unit, qty_step)
    if quantity <= 0:
        return SizeResult(D("0"), basis, max_risk, 0, "REJECT_QUANTITY_BELOW_MINIMUM")
    notional = quantity * entry
    fee_reserve = quantity * (entry + stop) * taker_fee
    leverage = select_leverage(notional, available_margin, fee_reserve, max_leverage)
    if leverage is None:
        return SizeResult(quantity, basis, max_risk, 0, "REJECT_INSUFFICIENT_MARGIN_AT_5X")
    if quantity * per_unit > max_risk:
        return SizeResult(D("0"), basis, max_risk, leverage, "REJECT_POSITION_RISK_ABOVE_1_PERCENT")
    return SizeResult(quantity, basis, max_risk, leverage)


def max_compliant_quantity(
    max_risk: D,
    entry: D,
    stop: D,
    qty_step: D,
    taker_fee: D = D("0.0006"),
) -> D:
    per_unit = abs(entry - stop) + (entry + stop) * taker_fee
    if per_unit <= 0:
        return D("0")
    return floor_step(max_risk / per_unit, qty_step)


def stop_distance_valid(entry: D, stop: D) -> str | None:
    if entry <= 0:
        return "REJECT_STOP_INVALID_SIDE"
    ratio = abs(entry - stop) / entry
    if ratio < D("0.002"):
        return "REJECT_STOP_BELOW_MIN_DISTANCE"
    if ratio > D("0.03"):
        return "REJECT_STOP_ABOVE_MAX_DISTANCE"
    return None


def split_quantity(qty: D, step: D, min_qty: D, min_notional: D, tp2_price: D):
    tp1 = floor_step(qty * D("0.5"), step)
    tp2 = floor_step(qty * D("0.3"), step)
    runner = qty - tp1 - tp2
    if tp1 < min_qty or tp2 < min_qty:
        raise ValueError("REJECT_POSITION_TOO_SMALL_FOR_PARTIAL_EXITS")
    if runner < min_qty or runner * tp2_price < min_notional:
        tp2 += runner
        runner = D("0")
    return tp1, tp2, runner
