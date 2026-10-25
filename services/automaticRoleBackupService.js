const db = require('../database/database');

db.exec(`
  CREATE TABLE IF NOT EXISTS automatic_role_backups (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role_ids_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, user_id)
  );
`);

function shouldIgnoreAutomaticBackup(member) {
  if (!member?.guild || !member?.user) {
    return true;
  }

  const quarantineRoleId =
    String(process.env.QUARANTINE_ROLE_ID || '').trim();

  /*
   * Do not overwrite a healthy role backup while someone is quarantined.
   */
  if (
    quarantineRoleId
    && member.roles.cache.has(quarantineRoleId)
  ) {
    return true;
  }

  return false;
}

function saveAutomaticRoleBackup(member) {
  if (shouldIgnoreAutomaticBackup(member)) {
    return {
      saved: false,
      roles: [],
    };
  }

  const roleIds = member.roles.cache
    .filter((role) =>
      role.id !== member.guild.id
      && !role.managed
    )
    .map((role) => role.id);

  db.prepare(`
    INSERT OR REPLACE INTO automatic_role_backups (
      guild_id,
      user_id,
      role_ids_json,
      updated_at
    )
    VALUES (?, ?, ?, ?)
  `).run(
    member.guild.id,
    member.id,
    JSON.stringify(roleIds),
    Date.now()
  );

  return {
    saved: true,
    roles: roleIds,
  };
}

function getAutomaticRoleBackup(guildId, userId) {
  const row = db.prepare(`
    SELECT role_ids_json, updated_at
    FROM automatic_role_backups
    WHERE guild_id = ? AND user_id = ?
  `).get(guildId, userId);

  if (!row) return null;

  let roleIds = [];

  try {
    const parsed = JSON.parse(row.role_ids_json);

    if (Array.isArray(parsed)) {
      roleIds = parsed.filter(
        (roleId) => typeof roleId === 'string'
      );
    }
  } catch (_) {}

  return {
    roleIds,
    updatedAt: row.updated_at,
  };
}

module.exports = {
  shouldIgnoreAutomaticBackup,
  saveAutomaticRoleBackup,
  getAutomaticRoleBackup,
};
