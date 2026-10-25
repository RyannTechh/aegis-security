const db = require('../database/database');

const APPROVAL_GUILD_ID = '1415110755057139875';
const APPROVAL_CHANNEL_ID = '1540161224854208652';

db.exec(`
  CREATE TABLE IF NOT EXISTS guild_approvals (
    guild_id TEXT PRIMARY KEY,
    guild_name TEXT NOT NULL,
    owner_id TEXT,
    member_count INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    message_id TEXT,
    requested_at INTEGER NOT NULL,
    decided_at INTEGER,
    decided_by TEXT
  );
`);

function createPendingApproval(guild) {
  db.prepare(`
    INSERT OR REPLACE INTO guild_approvals (
      guild_id,
      guild_name,
      owner_id,
      member_count,
      status,
      message_id,
      requested_at,
      decided_at,
      decided_by
    )
    VALUES (?, ?, ?, ?, 'pending', NULL, ?, NULL, NULL)
  `).run(
    guild.id,
    guild.name,
    guild.ownerId || null,
    guild.memberCount || 0,
    Date.now()
  );
}

function attachApprovalMessage(guildId, messageId) {
  db.prepare(`
    UPDATE guild_approvals
    SET message_id = ?
    WHERE guild_id = ?
  `).run(messageId, guildId);
}

function getApproval(guildId) {
  return db.prepare(`
    SELECT *
    FROM guild_approvals
    WHERE guild_id = ?
  `).get(guildId);
}

function setApprovalStatus(guildId, status, decidedBy) {
  const result = db.prepare(`
    UPDATE guild_approvals
    SET status = ?,
        decided_at = ?,
        decided_by = ?
    WHERE guild_id = ?
      AND status = 'pending'
  `).run(
    status,
    Date.now(),
    decidedBy,
    guildId
  );

  return result.changes > 0;
}

module.exports = {
  APPROVAL_GUILD_ID,
  APPROVAL_CHANNEL_ID,
  createPendingApproval,
  attachApprovalMessage,
  getApproval,
  setApprovalStatus,
};
