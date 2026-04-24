# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Project: Office Control

A small-business office management web app. Roles: admin (full access) and staff (read-only on staff/clients, own work logs only). Session-cookie auth with seeded demo accounts.

### Demo Credentials
- Admin: `admin@office.app` / `admin123`
- Staff: `alex@office.app` / `staff123`

### Artifacts
- `artifacts/office-control` (web, react-vite, preview path `/`) — frontend with sidebar+topbar shell, all pages: dashboard, staff, clients, tasks, attendance, work logs, invoices (+ printable detail), reports (recharts), notifications, settings.
- `artifacts/api-server` (api) — Express 5 routes: `/api/auth/*`, `/api/staff`, `/api/clients`, `/api/tasks`, `/api/attendance/*`, `/api/work-logs`, `/api/invoices`, `/api/notifications`, `/api/dashboard/*`, `/api/reports/*`.

### Auth
Session cookies stored in `sessions` table. Passwords hashed with `scrypt`. `attachUser` middleware mounts user from cookie; `requireAuth`/`requireAdmin` guard routes.

### DB Schemas (lib/db/src/schema)
`users`, `sessions`, `clients`, `tasks`, `attendance`, `workLogs`, `invoices`, `notifications`.

### Seed
`cd artifacts/api-server && pnpm exec tsx src/seed.ts` — idempotent (skips if users exist).
