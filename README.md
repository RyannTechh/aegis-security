# Aegis Security

Keep your community protected and organized with Aegis Security Discord moderation across servers, anti-nuke protection, role management, support tickets, welcome messages, and role/channel recovery. Built for FiveM communities, with player verification and server status monitoring.

## Features

- Moderation: bans, kicks, timeouts, role removal, and actions across connected servers.
- Security: channel deletion protection, permission escalation checks, quarantine, lockdown, and panic controls.
- Recovery: role/channel configuration snapshots and member role backups.
- Community: support tickets, role requests, temporary roles, donor bundles, and welcome messages.
- FiveM: player verification, live server status, and monitoring posts.

## Quick start

1. Install Node.js 20 or newer, matching the source package requirements.
2. Copy `.env.example` to `.env` and configure the bot, owner IDs, and feature settings.
3. Run `npm ci` from this folder.
4. Run `npm run check` to check syntax without starting the bot.
5. Run `npm run deploy` to register commands, then `npm start`.

Read [Setup](docs/SETUP.md) before deploying. Deployment and startup connect to Discord.

## Repository layout

| Folder | Contents |
| --- | --- |
| `commands/` | Slash commands grouped by feature |
| `events/` | Discord event handlers |
| `services/` | Moderation, security, community, and FiveM logic |
| `handlers/` | Command and event loaders |
| `database/` | SQLite schema and initialization; live data is ignored |
| `utils/` | Permissions, checks, embeds, and shared branding |
| `assets/` | Original image assets |
| `scripts/` | Local verification tools |
| `docs/` | Setup, command inventory, and import notes |

See the [command inventory](docs/COMMANDS.md) and [import notes](docs/IMPORT-NOTES.md).

## Branding

Package metadata and shared embed footers use **Aegis Security**. Original SALRP/Miami artwork and community-specific messages remain available for customization. Legacy configuration names and the FiveM verification header remain compatible with the source.

Credentials and live databases are excluded. No license was added because the source archive did not supply one.
