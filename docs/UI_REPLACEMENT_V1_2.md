# B Bot V1.2 UI Replacement Report

## Purpose

This package is prepared for a full-file replacement of the existing Replit/GitHub project while preserving the existing React visual structure.

## Visible corrections

- Branding is **B Bot / Bybit Insw Bot**.
- Legacy **Crypto AI** and **TRADEX** presentation is removed from the active frontend.
- Legacy grade badges (**A, B+, Grade**) are removed.
- Legacy strategies (**FVG, CHoCH, Liquidity Sweep**) are removed from the active frontend presentation.
- Scanner status now shows **VALID** or **WAITING**, not a grade.
- Signal and trade pages show the approved B Bot strategy names returned by the B Bot backend.
- The scanner description states manual Top-50 Bybit Demo scanning using closed 1H and 15M candles.
- Version marker is **Demo V1.2**.

## Replacement requirement

Delete the old repository files before copying this package. Do not copy the ZIP into the old source tree without extracting it. Old Replit build caches must also be removed.

Run:

```bash
bash scripts/clean-replit-cache.sh
corepack enable
pnpm install --frozen-lockfile
bash scripts/run-bbot.sh
```

## Validation limitation

The package environment could not download pnpm because external DNS/npm registry access was unavailable. The modified TypeScript source was statically inspected and all active frontend references to Crypto AI, TRADEX, grade badges, FVG, CHoCH and Liquidity Sweep were removed. Full Replit typecheck/build remains required after replacement.
