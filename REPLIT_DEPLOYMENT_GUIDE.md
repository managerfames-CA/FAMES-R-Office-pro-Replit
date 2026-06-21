# FAMES & R Office Work — Replit Deployment Guide

## A. Import the final ZIP

1. Sign in to Replit.
2. Open the Replit import page.
3. Select **ZIP**.
4. Upload `FAMES-R-Office-Work-Replit-Ready-Final.zip`.
5. Confirm the imported project root directly contains `package.json`, `package-lock.json`, `.replit`, `server.mjs`, `src`, and `scripts`. There must not be an extra duplicate nested project folder.
6. Select **Import**.

The ZIP intentionally excludes `node_modules`, `dist`, local `.env` files, caches, logs, and unrelated ZIP files.

## B. Replit Secrets and environment

### Required Secrets

None for the current approved release.

### Included non-secret configuration

- Node.js module: Node 24
- Development/internal port: 3000
- External port: 80
- Host binding: `0.0.0.0`
- Deployment type: Autoscale

Do not create `DATABASE_URL`, `SESSION_SECRET`, an admin password, or API keys for this release; the application does not consume them.

## C. Run in the Replit workspace

1. Open **Shell**.
2. Run:

```bash
npm ci
```

3. Select the Replit **Run** button. The included `.replit` file executes:

```bash
npm run dev
```

4. Preview should open through internal port 3000.
5. Confirm the Dashboard appears.

Manual alternative:

```bash
npm run dev
```

## D. Run verification before publishing

In Shell, run:

```bash
npm run typecheck
npm run test:run
npm run build
npm run verify:production
```

Expected results:

- TypeScript: 0 errors
- Automated tests: 379/379 passed
- Build: PASS
- Production verification: PASS

For a manual production start:

```bash
npm run build
npm run start
```

The server uses `PORT` dynamically and defaults to port 3000.

## E. Publish on Replit

1. Open **Publishing/Deployments**.
2. Choose **Autoscale**.
3. Verify the commands detected from `.replit`:

**Build command**

```bash
npm ci && npm run build
```

**Run command**

```bash
npm run start
```

4. Confirm one public service is exposed.
5. No deployment secret is required.
6. Select **Publish/Deploy**.
7. Open the published URL after deployment succeeds.

## F. Post-publish tests

1. Open the published root page and confirm the Dashboard loads.
2. Open `/health` on the published domain. Expected JSON includes:

```json
{
  "status": "ok",
  "persistence": "browser-localStorage",
  "databaseConfigured": false,
  "authenticationConfigured": false
}
```

3. Navigate through Clients, Staff, Engagements, Tasks, Deadlines, Workload, Timesheets, Expenses, Billing, Communications, Reports, Administration, and major audit workspaces.
4. Create a harmless test record in a non-production test browser profile.
5. Refresh the page and confirm the record remains.
6. Stop and restart the Replit development process or republish the same code, reopen the same browser profile and domain, and confirm the test record remains.
7. Export a full JSON backup from Administration before clearing browser data or changing domains.

## G. Persistence interpretation

A successful restart check proves only browser `localStorage` persistence for the same origin and browser profile. It does not prove server/database persistence.

Data will not automatically appear in:

- another browser
- another device
- another Replit domain
- incognito/private mode
- another user's browser profile

Clearing site data can remove records. Use the built-in backup/export capability.

## H. Database configuration

There is no database configuration step for this release because the approved application has no server database adapter or API.

Do not connect the old Replit PostgreSQL schema. It covers only a small, incompatible subset of the final application's 55 storage modules and uses different IDs, statuses, roles, and relationships.

A future database release requires:

1. Approved full schema design.
2. Mapping for all storage modules.
3. Migrations and seed policy.
4. API contracts and validation.
5. Authentication and authorization design.
6. Backup/restore migration.
7. Concurrency and audit-log controls.
8. Full regression and security testing.

## I. Troubleshooting

### Preview does not open

Confirm the process is listening on `0.0.0.0:3000` and `.replit` contains one port mapping from local port 3000 to external port 80.

### Production says build missing

Run:

```bash
npm ci
npm run build
npm run start
```

### Port error

Remove any invalid custom `PORT` value. The value must be an integer from 1 to 65535.

### Data missing

Check that the same published domain and browser profile are being used. Do not clear site data. Restore the latest JSON backup when available.
