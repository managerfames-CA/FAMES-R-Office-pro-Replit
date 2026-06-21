# Security Report — B Bot Replit Integrated V1.1

Date: 21 June 2026

## Implemented controls

- Demo environment is enforced in backend configuration.
- Real mode is rejected at startup.
- Private REST host is restricted to the Demo host.
- Bybit API credentials remain backend-only environment variables.
- `.env`, local databases, caches and secrets are excluded from the release package.
- Scanner Start/Stop, controlled settings, journal writes and manual-close endpoints require `APP_ADMIN_TOKEN`.
- The UI sends the control token only as `X-Admin-Token`; it never receives Bybit credentials.
- Unique `orderLinkId` values are used for exchange actions.
- Unknown entry results block duplicate submissions and require reconciliation.
- One active trade per symbol is enforced at the database layer.
- An unverified effective stop triggers emergency reduce-only closure and a global entry lock.
- B Bot database tables use a separate `bbot_*` namespace.

## Deployment requirements

- Use HTTPS.
- Generate a long random `APP_ADMIN_TOKEN`.
- Give the Bybit Demo API key only read/trade permissions required by the bot.
- Do not enable withdrawal permissions.
- Do not place secrets in source control, screenshots or support messages.
- Rotate credentials if they are exposed.
- Restrict access to the Replit project and deployment.

## Remaining validation

Authenticated Demo API permissions, private WebSocket authentication, exchange order verification and emergency-close behavior must be validated in the user's Replit environment.
