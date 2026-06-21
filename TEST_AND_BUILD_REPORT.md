# FAMES & R Office Work — Replit Test and Build Report

**Date:** 21 June 2026  
**Release:** 7.1.0-replit.1

## Result summary

| Verification | Command / method | Result |
|---|---|---|
| Dependency installation | `npm ci` | PASS; 122 packages installed, 0 vulnerabilities reported |
| TypeScript | `npm run typecheck` | PASS; 0 TypeScript errors |
| Automated regression | `npm run test:run` | PASS; 379/379 tests across 15 files |
| Component/route tests | Vitest component group | PASS; 78/78 |
| Unit/service/architecture tests | Vitest service group | PASS; 301/301 |
| Production build | `npm run build` | PASS; 111 modules transformed |
| Development run | `npm run dev` | PASS; HTTP 200 on port 3000 |
| Production start | `npm run start` with dynamic `PORT=43219` | PASS |
| Health endpoint | `/health` and `/api/health` | PASS; HTTP 200 JSON |
| Root page | `/` | PASS; application root loaded |
| Built JS asset | generated `/assets/*.js` | PASS; HTTP 200 and JavaScript MIME |
| Route fallback | `/clients` | PASS; application HTML returned |
| Missing static asset | `/assets/definitely-missing.js` | PASS; HTTP 404 |
| Invalid method | POST `/health` | PASS; HTTP 405 |
| HEAD request | HEAD `/` | PASS |
| Host binding | `0.0.0.0` | PASS |
| Dynamic port | `PORT` environment variable | PASS |
| Graceful shutdown | SIGTERM | PASS |
| Source preservation | recursive comparison of original and integrated `src/` | PASS; no differences |
| Clean-package verification | extract/install/build/start from release ZIP | **PASS — release candidate independently extracted into a clean directory; npm ci, TypeScript, 379/379 tests, production build, production start, and HTTP verification all passed.** |

## Automated test coverage executed

The complete approved test inventory was retained:

- Main component interactions and routes: 30
- Phase 3 components: 17
- Phase 4 components: 12
- Phase 5 components: 10
- Phase 6 components: 9
- Architecture: 11
- Core domain: 49
- Correction/regression: 28
- Phase 2A services: 35
- Phase 2 services: 36
- Phase 3 services: 35
- Phase 4 services: 41
- Phase 5 services: 36
- Phase 6 services: 26
- Phase 7 final acceptance: 4

**Total: 379 tests.**

## Build output

- `dist/index.html`: 0.77 kB
- `dist/assets/index-BS9kx6IR.css`: 21.84 kB
- `dist/assets/index-DJTQ6ln6.js`: 829.23 kB
- Build status: PASS
- Warning: Vite reports one JavaScript chunk above 500 kB. This is a non-blocking optimization warning and was not changed because code splitting would be an application architecture change outside deployment integration scope.

## Login verification

**Not applicable and not passed as a production control.** The approved source-of-truth has no login screen, authenticated user model, session backend, or authorization middleware. Staff roles are business workflow data only. The old reference login was intentionally not copied.

## Database verification

**No server database is configured.** Database startup was therefore tested as graceful non-requirement: the application starts without `DATABASE_URL`, health accurately reports no database, and no false persistence claim is made.

## Raw evidence

See `reports/replit-integration/` for dependency, typecheck, test, build, development server, production server, HTTP, source-integrity, and security outputs.
