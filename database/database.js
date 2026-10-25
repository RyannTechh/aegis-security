const Database = require('better-sqlite3');
const path = require('node:path');
const fs = require('node:fs');

const dbPath = process.env.DATABASE_PATH || './database/bot.sqlite';
const absolute = path.resolve(dbPath);
fs.mkdirSync(path.dirname(absolute), { recursive: true });

const db = new Database(absolute);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS whitelists (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  permission TEXT NOT NULL,
  added_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id, permission)
);

CREATE TABLE IF NOT EXISTS blacklists (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  added_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS global_blacklists (
  user_id TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  added_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS global_bans (
  user_id TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  added_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS global_ban_cases (
  case_id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  channel_id TEXT,
  message_id TEXT,
  offender_id TEXT NOT NULL,
  offender_tag TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by TEXT,
  reviewed_at INTEGER,
  last_reminded_at INTEGER,
  dm_sent INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS donator_bundles (
  guild_id TEXT NOT NULL,
  source_role_id TEXT NOT NULL,
  target_role_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, source_role_id, target_role_id)
);

CREATE TABLE IF NOT EXISTS protected_roles (
  guild_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  punishment TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, role_id)
);

CREATE TABLE IF NOT EXISTS temporary_roles (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  added_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id, role_id)
);

CREATE TABLE IF NOT EXISTS offices (
  guild_id TEXT NOT NULL,
  channel_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS office_access (
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS invite_servers (
  name TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS guild_backups (
  guild_id TEXT PRIMARY KEY,
  snapshot_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`);

module.exports = db;
