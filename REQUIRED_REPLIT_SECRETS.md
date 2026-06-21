# Required Replit Secrets

## Current approved release

**Required secrets: none.**

The application does not consume:

- `DATABASE_URL`
- `SESSION_SECRET`
- API keys
- OAuth credentials
- Admin credentials
- Email/SMS credentials
- Private service URLs

`PORT`, `HOST`, and `NODE_ENV` are ordinary runtime settings, not secrets. Replit's included `.replit` configuration sets the development port to 3000, while `server.mjs` accepts Replit's runtime `PORT` value.

## Important warning

Do not add a database URL or session secret and assume the application will use it. Database and authentication support are not implemented in this release. Those variables should be introduced only after an approved schema, migration, API, session, authorization, and data-security phase is completed and tested.
