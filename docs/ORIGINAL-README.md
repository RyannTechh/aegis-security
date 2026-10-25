# Massive Discord Management Bot

## Requirements
- Node.js 20 or newer
- A Discord application/bot with Server Members Intent and Message Content Intent enabled
- Bot permissions suitable for the commands you intend to use

## Setup
1. Rename `.env.example` to `.env`.
2. Fill in `TOKEN`, `CLIENT_ID`, owner IDs, role IDs, category IDs, and log channel IDs.
3. Run:
   ```bash
   npm install
   npm run deploy
   npm start
   ```

## Important
- Put role IDs in comma-separated lists with no spaces required.
- The bot role must be above roles it assigns, removes, restores, or protects.
- Global commands only work in guilds where the bot is installed.
- `/apirestore save` creates a guild configuration snapshot.
- `/apirestore restore` restores missing roles and channels from the latest snapshot.
- Role protection relies on Discord audit logs and requires `View Audit Log`.
