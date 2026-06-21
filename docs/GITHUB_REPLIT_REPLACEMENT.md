# GitHub/Replit Replacement Procedure

1. Keep the existing GitHub `main` branch unchanged as a backup.
2. Create branch `b-bot-replit-integration-v1-1`.
3. Extract this ZIP locally.
4. Replace the repository working-tree files with the extracted contents; do not upload the ZIP itself as the application.
5. Do not copy `.env`, API keys or local database files.
6. Commit and push the branch.
7. Open the branch in Replit or switch the connected Replit project to the branch.
8. Add Replit Secrets: `BYBIT_API_KEY`, `BYBIT_API_SECRET`, `APP_ADMIN_TOKEN`, `DATABASE_URL`.
9. Press Run and confirm `/api/healthz` reports `DEMO`, `realMode=false`, `scannerState=STOPPED`.
10. Enter the same App Control token in the B Bot Settings page.
11. Complete the Demo validation checklist before merging to `main`.

Suggested commit message:

```text
Integrate B Bot Bybit Demo engine with preserved Replit UI
```
