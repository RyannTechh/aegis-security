const db = require('../database/database');
const { isOwner } = require('../utils/checks');

function hasWhitelist(guildId, userId, permission) {
  if (isOwner(userId)) return true;

  const row = db.prepare(`
    SELECT 1 FROM whitelists
    WHERE guild_id = ? AND user_id = ? AND permission IN (?, 'All')
    LIMIT 1
  `).get(guildId, userId, permission);

  return Boolean(row);
}

function addWhitelist(guildId, userId, permission, addedBy) {
  db.prepare(`
    INSERT OR REPLACE INTO whitelists
    (guild_id, user_id, permission, added_by, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(guildId, userId, permission, addedBy, Date.now());
}

function removeWhitelist(guildId, userId, permission) {
  return db.prepare(`
    DELETE FROM whitelists WHERE guild_id = ? AND user_id = ? AND permission = ?
  `).run(guildId, userId, permission).changes;
}

function getWhitelist(guildId, userId) {
  return db.prepare(`
    SELECT permission, added_by, created_at FROM whitelists
    WHERE guild_id = ? AND user_id = ?
    ORDER BY permission
  `).all(guildId, userId);
}

module.exports = { hasWhitelist, addWhitelist, removeWhitelist, getWhitelist };
