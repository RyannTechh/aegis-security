const db = require('../database/database');
const { PermissionFlagsBits } = require('discord.js');

db.exec(`CREATE TABLE IF NOT EXISTS lockdown_backups (guild_id TEXT NOT NULL, channel_id TEXT NOT NULL, allow_bits TEXT NOT NULL, deny_bits TEXT NOT NULL, PRIMARY KEY(guild_id, channel_id)); CREATE TABLE IF NOT EXISTS lockdown_state (guild_id TEXT PRIMARY KEY, active INTEGER NOT NULL DEFAULT 0, started_by TEXT, started_at INTEGER);`);

function state(guildId) { return db.prepare('SELECT * FROM lockdown_state WHERE guild_id = ?').get(guildId) || { active: 0 }; }

async function start(guild, userId) {
  if (state(guild.id).active) return { alreadyActive: true, changed: 0, failed: 0 };
  const everyone = guild.roles.everyone;
  const save = db.prepare('INSERT OR REPLACE INTO lockdown_backups (guild_id, channel_id, allow_bits, deny_bits) VALUES (?, ?, ?, ?)');
  let changed = 0, failed = 0;
  for (const channel of guild.channels.cache.values()) {
    if (!channel.permissionOverwrites) continue;
    const current = channel.permissionOverwrites.cache.get(everyone.id);
    save.run(guild.id, channel.id, (current?.allow?.bitfield || 0n).toString(), (current?.deny?.bitfield || 0n).toString());
    try {
      await channel.permissionOverwrites.edit(everyone, {
        SendMessages: false,
        AddReactions: false,
        CreatePublicThreads: false,
        CreatePrivateThreads: false,
        SendMessagesInThreads: false,
        Connect: false,
        Speak: false,
      }, { reason: `Emergency lockdown by ${userId}` });
      changed++;
    } catch (_) { failed++; }
  }
  db.prepare('INSERT OR REPLACE INTO lockdown_state (guild_id, active, started_by, started_at) VALUES (?, 1, ?, ?)').run(guild.id, userId, Date.now());
  return { alreadyActive: false, changed, failed };
}

async function restore(guild, userId) {
  if (!state(guild.id).active) return { notActive: true, restored: 0, failed: 0 };
  const rows = db.prepare('SELECT * FROM lockdown_backups WHERE guild_id = ?').all(guild.id);
  let restored = 0, failed = 0;
  for (const row of rows) {
    const channel = guild.channels.cache.get(row.channel_id);
    if (!channel?.permissionOverwrites) continue;
    try {
      await channel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: null, AddReactions: null, CreatePublicThreads: null,
        CreatePrivateThreads: null, SendMessagesInThreads: null, Connect: null, Speak: null,
      }, { reason: `Lockdown restored by ${userId}` });
      const allow = BigInt(row.allow_bits), deny = BigInt(row.deny_bits);
      await channel.permissionOverwrites.edit(guild.roles.everyone, { allow, deny }, { reason: `Restore pre-lockdown permissions by ${userId}` });
      restored++;
    } catch (_) { failed++; }
  }
  db.prepare('DELETE FROM lockdown_backups WHERE guild_id = ?').run(guild.id);
  db.prepare('INSERT OR REPLACE INTO lockdown_state (guild_id, active, started_by, started_at) VALUES (?, 0, NULL, NULL)').run(guild.id);
  return { notActive: false, restored, failed };
}
module.exports = { state, start, restore };
