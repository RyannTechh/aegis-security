const db = require('../database/database');

db.exec(`
  CREATE TABLE IF NOT EXISTS role_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    requester_id TEXT NOT NULL,
    approver_id TEXT NOT NULL,
    target_user_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    message_id TEXT,
    channel_id TEXT,
    created_at INTEGER NOT NULL,
    decided_at INTEGER,
    decided_by TEXT
  );

  CREATE TABLE IF NOT EXISTS role_request_approvals (
    guild_id TEXT NOT NULL,
    requested_role_id TEXT NOT NULL,
    approver_role_id TEXT NOT NULL,
    configured_by TEXT NOT NULL,
    configured_at INTEGER NOT NULL,
    PRIMARY KEY (
      guild_id,
      requested_role_id,
      approver_role_id
    )
  );
`);

function createRoleRequest({
  guildId,
  requesterId,
  approverId,
  targetUserId,
  roleId,
  channelId,
}) {
  const result = db.prepare(`
    INSERT INTO role_requests (
      guild_id,
      requester_id,
      approver_id,
      target_user_id,
      role_id,
      status,
      channel_id,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(
    guildId,
    requesterId,
    approverId,
    targetUserId,
    roleId,
    channelId,
    Date.now()
  );

  return Number(result.lastInsertRowid);
}

function attachMessage(requestId, messageId) {
  db.prepare(`
    UPDATE role_requests
    SET message_id = ?
    WHERE id = ?
  `).run(messageId, requestId);
}

function getRoleRequest(requestId) {
  return db.prepare(`
    SELECT *
    FROM role_requests
    WHERE id = ?
  `).get(requestId);
}

function resolveRoleRequest(requestId, status, decidedBy) {
  db.prepare(`
    UPDATE role_requests
    SET status = ?,
        decided_at = ?,
        decided_by = ?
    WHERE id = ?
      AND status = 'pending'
  `).run(
    status,
    Date.now(),
    decidedBy,
    requestId
  );
}

function addApprovalRole(
  guildId,
  requestedRoleId,
  approverRoleId,
  configuredBy
) {
  db.prepare(`
    INSERT OR REPLACE INTO role_request_approvals (
      guild_id,
      requested_role_id,
      approver_role_id,
      configured_by,
      configured_at
    )
    VALUES (?, ?, ?, ?, ?)
  `).run(
    guildId,
    requestedRoleId,
    approverRoleId,
    configuredBy,
    Date.now()
  );
}

function removeApprovalRole(
  guildId,
  requestedRoleId,
  approverRoleId
) {
  return db.prepare(`
    DELETE FROM role_request_approvals
    WHERE guild_id = ?
      AND requested_role_id = ?
      AND approver_role_id = ?
  `).run(
    guildId,
    requestedRoleId,
    approverRoleId
  ).changes;
}

function getApprovalRoles(guildId, requestedRoleId) {
  return db.prepare(`
    SELECT approver_role_id
    FROM role_request_approvals
    WHERE guild_id = ?
      AND requested_role_id = ?
    ORDER BY configured_at ASC
  `).all(
    guildId,
    requestedRoleId
  );
}

function listApprovalMappings(guildId) {
  return db.prepare(`
    SELECT
      requested_role_id,
      approver_role_id,
      configured_by,
      configured_at
    FROM role_request_approvals
    WHERE guild_id = ?
    ORDER BY configured_at ASC
  `).all(guildId);
}

function memberCanApproveRole(member, requestedRoleId) {
  if (!member) return false;

  const allowedRoles = getApprovalRoles(
    member.guild.id,
    requestedRoleId
  );

  if (!allowedRoles.length) {
    return false;
  }

  return allowedRoles.some((row) =>
    member.roles.cache.has(row.approver_role_id)
  );
}

module.exports = {
  createRoleRequest,
  attachMessage,
  getRoleRequest,
  resolveRoleRequest,
  addApprovalRole,
  removeApprovalRole,
  getApprovalRoles,
  listApprovalMappings,
  memberCanApproveRole,
};
