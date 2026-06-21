# Final Corrected SRS — Relaxed Demo V1

## Locked corrections

1. Risk basis is `min(configured Bot Trading Capital, verified usable Bybit Demo equity)`.
2. Default Bot Trading Capital is 1,000 USDT; default maximum risk is 10 USDT.
3. Daily entry lock activates only after four completed full-risk losses.
4. Full-risk loss means net loss at least 90% of initial approved risk.
5. Partial losses and fee-only breakeven losses do not increment the full-risk counter.
6. No cumulative 4% daily-loss lock exists in Relaxed Demo V1.
7. Scanner starts manually and is forced to STOPPED after every backend restart.
8. EMA200, regime logic, grades, scores, volume filters, RSI, MACD, ATR, ADX and session/news filters are prohibited.
9. Dynamic leverage selects the lowest affordable integer from 1× through 5×; never above 5×.
10. An effective exchange stop must be verified. Bounded failure requires reduce-only emergency closure and global entry lock.
11. Real mode is disabled.

## Deterministic strategies

The implementation uses the approved formulas for EMA Rejection, Price Action, Trend Pullback, Breakout and Retest, and Support/Resistance Rejection, with OR logic and one direction-aligned closed-15M confirmation. The formulas are implemented in `backend/app/strategy.py` and tested in `backend/tests/test_strategy.py`.

## Risk and execution

The implementation preserves market entry, 0.30% maximum slippage, actual weighted-average fill authority, 0.20%–3.00% stop distance, TP1 50% at 2R, TP2 30% at 3R, runner residual, breakeven after verified TP1 and 15M structure trailing after verified TP2.
