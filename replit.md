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

## Project: FAMES & R Workspace (artifact dir: `office-control`)

A small-business office management web app branded as "FAMES & R Workspace" with the tagline "Manage • Collaborate • Grow" (blue/green palette). Roles: admin (monitor/approver, implicit full access) and staff (doer, own work + per-permission visibility). Session-cookie auth (`office_session`) with seeded demo accounts.

### Permissions System
Per-staff permission keys stored on `users.permissions text[]`:
`view_reports`, `view_invoices`, `manage_invoices`, `manage_clients`, `view_team_attendance`, `view_team_work_logs`. Admin role implies all. Frontend uses `useAuth().can(key)`; admin-only pages gated by `requireAdmin` middleware.

### Work-Log Approval Workflow
`work_logs.approval_status` ∈ `draft | submitted | approved | rejected`, plus `review_notes`, `reviewed_by`, `reviewed_at`. Staff submits via "Submit for review" checkbox on create/edit. Admin sees pending count badge in nav, reviews queue at `/pending-approvals`, approves or rejects with optional notes. Endpoints: `GET /api/work-logs/pending-approvals`, `POST /api/work-logs/:id/approve`, `POST /api/work-logs/:id/reject`.

### Force Change Password
`users.must_change_password` boolean. When true, `AppLayout` redirects every page to `/change-password`. `POST /api/auth/change-password` validates current password, updates hash, clears the flag. Admin can reset a staffer's password with `POST /api/staff/:id/reset-password` (returns temp password, sets the flag).

### Demo Credentials
- Admin: `admin@office.app` / `admin123`
- Staff: `alex@office.app` / `staff123` (has team-visibility perms)
- Staff: `morgan@office.app` / `staff123` (has invoice-view perms)
- Staff: `sam@office.app` / `staff123` (forced password change on first login)
- Staff: `jamie@office.app` / `staff123`

### Artifacts
- `artifacts/office-control` (web, react-vite, preview path `/`) — frontend with sidebar+topbar shell, all pages: dashboard, staff, clients, tasks, attendance, work logs, invoices (+ printable detail), reports (recharts), notifications, settings.
- `artifacts/api-server` (api) — Express 5 routes: `/api/auth/*`, `/api/staff`, `/api/clients`, `/api/tasks`, `/api/attendance/*`, `/api/work-logs`, `/api/invoices`, `/api/notifications`, `/api/dashboard/*`, `/api/reports/*`.

### Auth
Session cookies stored in `sessions` table. Passwords hashed with `scrypt`. `attachUser` middleware mounts user from cookie; `requireAuth`/`requireAdmin` guard routes.

### DB Schemas (lib/db/src/schema)
`users`, `sessions`, `clients`, `tasks`, `attendance`, `workLogs`, `invoices`, `notifications`.

### Seed
`cd artifacts/api-server && pnpm exec tsx src/seed.ts` — idempotent (skips if users exist).
