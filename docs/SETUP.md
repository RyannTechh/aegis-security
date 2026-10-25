# Setup

## Discord

Use a Discord bot application and set TOKEN and CLIENT_ID in your local .env. Set OWNER_IDS to the comma-separated IDs authorized to use owner commands.

Enable Server Members Intent and Message Content Intent in the Discord developer portal. Grant the permissions needed by your chosen features, including View Audit Log for audit-based protection. Place the bot role above roles it must assign, remove, protect, or restore. Global actions apply to servers where the bot is installed and has permission.

Run npm commands from the repository root so the database path resolves correctly. SQLite tables are initialized by the source. better-sqlite3 may require native build tools if a prebuilt binary is unavailable.

## Feature settings

.env.example lists configuration keys found in the source and original configuration, with original values removed. Supply role, channel, and category IDs for enabled features. Role-list settings use comma-separated IDs. Configure ticket category permissions before posting a ticket panel.

For FiveM status, configure FIVEM_JOIN_CODE and, if needed, FIVEM_STATUS_BASE_URL. Set the status and monitoring channel IDs for automatic posts.

FiveM verification requires a server-side FiveM integration that POSTs join details to /fivem/verification/join with the x-salrp-verify-secret header matching FIVEM_VERIFY_SECRET. That FiveM integration is not included in this archive. Configure the verification role, panel channel, API port, and join window. IP enforcement depends on trusted player IP information supplied by that integration.

## Run

```sh
npm ci
npm run check
npm run deploy
npm start
```

Deploy registers global slash commands. Start logs in and activates configured event handlers. Neither was run during this import.

## Existing installation

The original archive remains unchanged. Its .env, SQLite database, WAL, and SHM are excluded from this repository. For migration, take a consistent database backup with the existing bot stopped; do not copy only the main SQLite file while it is actively writing. Keep credentials and runtime data outside Git.

## Verification limits

Import validation checks syntax, relative module paths, image paths, and Git exclusions. Live Discord permissions, FiveM connectivity, and every bot feature have not been tested. Review existing community-specific IDs, artwork, and text before use in another community.
