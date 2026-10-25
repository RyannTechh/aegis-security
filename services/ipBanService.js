const net = require('node:net');
const db = require('../database/database');

db.exec(`
  CREATE TABLE IF NOT EXISTS ip_bans (
    guild_id TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    reason TEXT NOT NULL,
    added_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, ip_address)
  );
`);

function normalizeIp(value) {
  let ip = String(value || '').trim();
  if (!ip) return null;

  // FiveM/Node can represent IPv4 clients as IPv4-mapped IPv6 addresses.
  if (ip.toLowerCase().startsWith('::ffff:')) {
    const mapped = ip.slice(7);
    if (net.isIP(mapped) === 4) ip = mapped;
  }

  // Remove brackets from bracketed IPv6 values, e.g. [2001:db8::1].
  if (ip.startsWith('[') && ip.endsWith(']')) {
    ip = ip.slice(1, -1);
  }

  return net.isIP(ip) ? ip.toLowerCase() : null;
}

function addIpBan(guildId, ipAddress, reason, addedBy) {
  const ip = normalizeIp(ipAddress);
  if (!ip) throw new Error('Invalid IP address.');

  db.prepare(`
    INSERT INTO ip_bans (guild_id, ip_address, reason, added_by, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(guild_id, ip_address) DO UPDATE SET
      reason = excluded.reason,
      added_by = excluded.added_by,
      created_at = excluded.created_at
  `).run(
    String(guildId),
    ip,
    String(reason || 'No reason provided').slice(0, 500),
    String(addedBy),
    Date.now()
  );

  return getIpBan(guildId, ip);
}

function removeIpBan(guildId, ipAddress) {
  const ip = normalizeIp(ipAddress);
  if (!ip) return false;

  const result = db.prepare(`
    DELETE FROM ip_bans
    WHERE guild_id = ? AND ip_address = ?
  `).run(String(guildId), ip);

  return result.changes > 0;
}

function getIpBan(guildId, ipAddress) {
  const ip = normalizeIp(ipAddress);
  if (!ip) return null;

  return db.prepare(`
    SELECT guild_id, ip_address, reason, added_by, created_at
    FROM ip_bans
    WHERE guild_id = ? AND ip_address = ?
    LIMIT 1
  `).get(String(guildId), ip) || null;
}

function getIpBansForIp(ipAddress) {
  const ip = normalizeIp(ipAddress);
  if (!ip) return [];

  return db.prepare(`
    SELECT guild_id, ip_address, reason, added_by, created_at
    FROM ip_bans
    WHERE ip_address = ?
    ORDER BY created_at DESC
  `).all(ip);
}

function listIpBans(guildId, limit = 25) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 25, 100));

  return db.prepare(`
    SELECT guild_id, ip_address, reason, added_by, created_at
    FROM ip_bans
    WHERE guild_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(String(guildId), safeLimit);
}

function getDiscordIdsForIp(ipAddress) {
  const ip = normalizeIp(ipAddress);
  if (!ip) return [];

  try {
    const rows = db.prepare(`
      SELECT DISTINCT discord_id
      FROM fivem_verification_joins
      WHERE ip_address = ?
        AND discord_id IS NOT NULL
        AND discord_id != ''
    `).all(ip);

    return rows.map((row) => String(row.discord_id));
  } catch {
    // The FiveM verification table may not have been initialized yet.
    return [];
  }
}

async function banDiscordIdForIp(guild, discordId, banRecord) {
  if (!guild || !discordId || !banRecord) {
    return { ok: false, skipped: false, error: 'missing_data' };
  }

  const alreadyBanned = await guild.bans.fetch(discordId).catch(() => null);
  if (alreadyBanned) {
    return { ok: true, skipped: true, alreadyBanned: true };
  }

  const reason = `IP ban: ${banRecord.reason} | Added by ${banRecord.added_by}`.slice(0, 512);

  try {
    await guild.members.ban(discordId, { reason });
    return { ok: true, skipped: false, alreadyBanned: false };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      error: error?.message || 'ban_failed',
    };
  }
}

async function enforceIpBan(client, discordId, ipAddress) {
  const ip = normalizeIp(ipAddress);
  if (!ip) return [];

  const bans = getIpBansForIp(ip);
  const results = [];

  for (const banRecord of bans) {
    const guild = client.guilds.cache.get(banRecord.guild_id)
      || await client.guilds.fetch(banRecord.guild_id).catch(() => null);

    if (!guild) {
      results.push({
        guildId: banRecord.guild_id,
        ok: false,
        skipped: false,
        error: 'guild_not_found',
      });
      continue;
    }

    const result = await banDiscordIdForIp(guild, discordId, banRecord);
    results.push({ guildId: guild.id, ...result });
  }

  return results;
}

module.exports = {
  normalizeIp,
  addIpBan,
  removeIpBan,
  getIpBan,
  getIpBansForIp,
  listIpBans,
  getDiscordIdsForIp,
  banDiscordIdForIp,
  enforceIpBan,
};
