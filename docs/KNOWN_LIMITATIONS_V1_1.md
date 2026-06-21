# Known Limitations — V1.1

1. No authenticated Bybit Demo order was submitted during packaging because user credentials were not supplied.
2. The packaging sandbox had no external DNS, so Bybit connectivity and npm registry installation were unavailable.
3. Full frontend dependency-based typecheck/build must be confirmed in Replit; only TS/TSX syntax transpilation was possible locally.
4. Position breakeven and 15M swing-based trailing require the backend to remain online. Existing exchange-side orders remain, but an asleep backend cannot perform new dynamic amendments.
5. External/manual positions activate a global entry lock and require operator review.
6. The application creates a new `bbot_*` database namespace. It does not migrate old Binance/TRADEX records into B Bot.
7. `create_all()` initializes this new baseline. Future schema changes should introduce Alembic migrations.
8. Funding-related account adjustments may require additional reconciliation evidence during live Demo validation.
9. Real trading remains intentionally disabled.
