from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal as D
from hashlib import sha256

from .domain import Candle


@dataclass(frozen=True)
class SetupDefinition:
    strategy: str
    direction: str
    setup_close: int
    reference: D
    extreme: D
    expiry_candles: int = 8


@dataclass(frozen=True)
class StrategyResult:
    setups: list[SetupDefinition]
    reasons: list[str]


def ema(closes: list[D], period: int) -> D:
    if len(closes) < period:
        raise ValueError("insufficient history")
    seed = sum(closes[:period], D("0")) / D(period)
    alpha = D(2) / D(period + 1)
    value = seed
    for close in closes[period:]:
        value = alpha * close + (D(1) - alpha) * value
    return value


def valid_candle(candle: Candle) -> bool:
    return (
        candle.low > 0
        and candle.range > 0
        and candle.high >= max(candle.open, candle.close)
        and candle.low <= min(candle.open, candle.close)
    )


def bullish_engulfing(previous: Candle, current: Candle) -> bool:
    return (
        valid_candle(previous)
        and valid_candle(current)
        and previous.close < previous.open
        and current.close > current.open
        and current.open <= previous.close
        and current.close >= previous.open
        and current.body > previous.body
        and current.body_ratio >= D("0.30")
    )


def bearish_engulfing(previous: Candle, current: Candle) -> bool:
    return (
        valid_candle(previous)
        and valid_candle(current)
        and previous.close > previous.open
        and current.close < current.open
        and current.open >= previous.close
        and current.close <= previous.open
        and current.body > previous.body
        and current.body_ratio >= D("0.30")
    )


def bullish_rejection(candle: Candle, tick: D) -> bool:
    if not valid_candle(candle):
        return False
    return (
        candle.lower_wick >= D(2) * max(candle.body, tick)
        and candle.lower_wick / candle.range >= D("0.50")
        and candle.upper_wick / candle.range <= D("0.20")
        and candle.close >= candle.low + D("0.65") * candle.range
        and candle.body_ratio <= D("0.40")
        and candle.close >= candle.open
    )


def bearish_rejection(candle: Candle, tick: D) -> bool:
    if not valid_candle(candle):
        return False
    return (
        candle.upper_wick >= D(2) * max(candle.body, tick)
        and candle.upper_wick / candle.range >= D("0.50")
        and candle.lower_wick / candle.range <= D("0.20")
        and candle.close <= candle.low + D("0.35") * candle.range
        and candle.body_ratio <= D("0.40")
        and candle.close <= candle.open
    )


def swing_high(candles: list[Candle], index: int) -> bool:
    return 2 <= index < len(candles) - 2 and all(
        candles[index].high > candles[other].high
        for other in (index - 2, index - 1, index + 1, index + 2)
    )


def swing_low(candles: list[Candle], index: int) -> bool:
    return 2 <= index < len(candles) - 2 and all(
        candles[index].low < candles[other].low
        for other in (index - 2, index - 1, index + 1, index + 2)
    )


def latest_swing(candles: list[Candle], kind: str, max_age: int = 20):
    end = len(candles) - 3
    first = max(2, end - max_age + 1)
    for index in range(end, first - 1, -1):
        if kind == "high" and swing_high(candles, index):
            return index, candles[index]
        if kind == "low" and swing_low(candles, index):
            return index, candles[index]
    return None


def local_break(candles: list[Candle], direction: str, tick: D) -> bool:
    if len(candles) < 6:
        return False
    current = candles[-1]
    if direction == "LONG":
        reference = latest_swing(candles[:-1], "high")
        return bool(
            reference
            and current.close >= reference[1].high + tick
            and current.close > current.open
            and current.body_ratio >= D("0.30")
        )
    reference = latest_swing(candles[:-1], "low")
    return bool(
        reference
        and current.close <= reference[1].low - tick
        and current.close < current.open
        and current.body_ratio >= D("0.30")
    )


def confirmation_types(candles: list[Candle], direction: str, tick: D) -> list[str]:
    if len(candles) < 2:
        return []
    previous, current = candles[-2], candles[-1]
    results: list[str] = []
    if direction == "LONG":
        if bullish_engulfing(previous, current):
            results.append("BULLISH_ENGULFING")
        if bullish_rejection(current, tick):
            results.append("BULLISH_REJECTION")
    else:
        if bearish_engulfing(previous, current):
            results.append("BEARISH_ENGULFING")
        if bearish_rejection(current, tick):
            results.append("BEARISH_REJECTION")
    if local_break(candles, direction, tick):
        results.append("LOCAL_STRUCTURE_BREAK")
    return results


def trend(ema20: D, ema50: D, tick: D) -> str:
    rounded20 = (ema20 / tick).quantize(D("1")) * tick
    rounded50 = (ema50 / tick).quantize(D("1")) * tick
    return "LONG" if rounded20 > rounded50 else "SHORT" if rounded20 < rounded50 else "NEUTRAL"


def evaluate_1h(candles: list[Candle], direction: str, ema20: D, ema50: D, tick: D) -> StrategyResult:
    if len(candles) < 100:
        return StrategyResult([], ["INSUFFICIENT_HISTORY"])
    current = candles[-1]
    previous = candles[-2]
    setups: list[SetupDefinition] = []
    reasons: list[str] = []
    if direction == "NEUTRAL":
        return StrategyResult([], ["NEUTRAL_TREND"])

    touched = current.low <= ema20 * D("1.001") and current.high >= ema20 * D("0.999")
    ema_ok = (
        direction == "LONG" and touched and current.close >= ema20 + tick and current.close > ema50
    ) or (
        direction == "SHORT" and touched and current.close <= ema20 - tick and current.close < ema50
    )
    if ema_ok:
        setups.append(
            SetupDefinition(
                "EMA_REJECTION",
                direction,
                current.close_time,
                ema20,
                current.low if direction == "LONG" else current.high,
            )
        )
    else:
        reasons.append("EMA_REJECTION_NOT_MATCHED")

    price_action = (
        bullish_engulfing(previous, current) or bullish_rejection(current, tick)
        if direction == "LONG"
        else bearish_engulfing(previous, current) or bearish_rejection(current, tick)
    )
    if price_action:
        setups.append(
            SetupDefinition(
                "PRICE_ACTION",
                direction,
                current.close_time,
                (current.high + current.low) / D(2),
                current.low if direction == "LONG" else current.high,
            )
        )
    else:
        reasons.append("PRICE_ACTION_NOT_MATCHED")

    sequence: list[Candle] = []
    for candle in reversed(candles[-3:]):
        opposite = candle.close < candle.open if direction == "LONG" else candle.close > candle.open
        if not opposite:
            break
        sequence.append(candle)
    sequence.reverse()
    if 2 <= len(sequence) <= 3:
        zone_touched = any(
            candle.low <= max(ema20, ema50) * D("1.001")
            and candle.high >= min(ema20, ema50) * D("0.999")
            for candle in sequence
        )
        closes_valid = (
            all(candle.close > ema50 for candle in sequence)
            if direction == "LONG"
            else all(candle.close < ema50 for candle in sequence)
        )
        progresses = (
            sequence[-1].close < sequence[-2].close
            if direction == "LONG"
            else sequence[-1].close > sequence[-2].close
        )
        if zone_touched and closes_valid and progresses:
            setups.append(
                SetupDefinition(
                    "TREND_PULLBACK",
                    direction,
                    current.close_time,
                    ema20,
                    min(item.low for item in sequence) if direction == "LONG" else max(item.high for item in sequence),
                )
            )
        else:
            reasons.append("TREND_PULLBACK_NOT_MATCHED")
    else:
        reasons.append("TREND_PULLBACK_NOT_MATCHED")

    previous_twenty = candles[-21:-1]
    level = max(item.high for item in previous_twenty) if direction == "LONG" else min(item.low for item in previous_twenty)
    breakout = (
        direction == "LONG"
        and current.close >= level + tick
        and current.close > current.open
        and current.body_ratio >= D("0.30")
    ) or (
        direction == "SHORT"
        and current.close <= level - tick
        and current.close < current.open
        and current.body_ratio >= D("0.30")
    )
    if breakout:
        setups.append(
            SetupDefinition(
                "BREAKOUT_RETEST",
                direction,
                current.close_time,
                level,
                current.low if direction == "LONG" else current.high,
                12,
            )
        )
    else:
        reasons.append("BREAKOUT_RETEST_NOT_MATCHED")

    sr = latest_swing(candles[:-1], "low" if direction == "LONG" else "high", 40)
    if sr:
        level = sr[1].low if direction == "LONG" else sr[1].high
        touch = current.low <= level * D("1.0015") and current.high >= level * D("0.9985")
        pattern = bullish_rejection(current, tick) if direction == "LONG" else bearish_rejection(current, tick)
        close_ok = current.close >= level + tick if direction == "LONG" else current.close <= level - tick
        if touch and pattern and close_ok:
            setups.append(
                SetupDefinition(
                    "SUPPORT_RESISTANCE_REJECTION",
                    direction,
                    current.close_time,
                    level,
                    current.low if direction == "LONG" else current.high,
                )
            )
        else:
            reasons.append("SUPPORT_RESISTANCE_NOT_MATCHED")
    else:
        reasons.append("SUPPORT_RESISTANCE_LEVEL_MISSING")

    return StrategyResult(setups, reasons)


def setup_invalidated(strategy: str, direction: str, reference: D, extreme: D, candle: Candle, tick: D) -> bool:
    if strategy == "BREAKOUT_RETEST":
        return candle.close < reference * D("0.9985") if direction == "LONG" else candle.close > reference * D("1.0015")
    return candle.close < extreme - tick if direction == "LONG" else candle.close > extreme + tick


def breakout_retest_seen(direction: str, reference: D, candle: Candle) -> bool:
    intersects = candle.low <= reference * D("1.0015") and candle.high >= reference * D("0.9985")
    close_valid = candle.close >= reference * D("0.9985") if direction == "LONG" else candle.close <= reference * D("1.0015")
    return intersects and close_valid


def confirmation_matches_setup(
    strategy: str,
    direction: str,
    reference: D,
    confirmations: list[str],
    previous: Candle,
    current: Candle,
    retest_seen: bool,
    tick: D,
) -> bool:
    if not confirmations:
        return False
    is_local_break = "LOCAL_STRUCTURE_BREAK" in confirmations
    has_candle_confirmation = any("ENGULFING" in item or "REJECTION" in item for item in confirmations)

    if strategy == "EMA_REJECTION":
        return current.close > reference if direction == "LONG" else current.close < reference
    if strategy == "PRICE_ACTION":
        return current.close > reference if direction == "LONG" else current.close < reference
    if strategy == "TREND_PULLBACK":
        if is_local_break:
            return True
        return has_candle_confirmation and (current.close > previous.high if direction == "LONG" else current.close < previous.low)
    if strategy == "BREAKOUT_RETEST":
        if not retest_seen:
            return False
        return current.close >= reference + tick if direction == "LONG" else current.close <= reference - tick
    if strategy == "SUPPORT_RESISTANCE_REJECTION":
        return current.close > reference if direction == "LONG" else current.close < reference
    return False


def fingerprint(symbol: str, direction: str, setup_close: int, confirmation_close: int) -> str:
    return sha256(f"{symbol}|{direction}|{setup_close}|{confirmation_close}".encode()).hexdigest()
