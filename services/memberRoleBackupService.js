const db = require('../database/database');

db.exec(`
  CREATE TABLE IF NOT EXISTS member_role_backups (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role_ids_json TEXT NOT NULL,
    saved_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, user_id)
  );
`);

function getRestorableRoleIds(member) {
  return member.roles.cache
    .filter((role) =>
      role.id !== member.guild.id
      && !role.managed
    )
    .map((role) => role.id);
}

function saveMemberRoles(member) {
  if (!member?.guild || !member?.user) {
    throw new Error('A valid guild member is required.');
  }

  const roleIds = getRestorableRoleIds(member);

  db.prepare(`
    INSERT OR REPLACE INTO member_role_backups
    (guild_id, user_id, role_ids_json, saved_at)
    VALUES (?, ?, ?, ?)
  `).run(
    member.guild.id,
    member.id,
    JSON.stringify(roleIds),
    Date.now()
  );

  return {
    roleIds,
    savedAt: Date.now(),
  };
}

function getMemberRoleBackup(guildId, userId) {
  const row = db.prepare(`
    SELECT role_ids_json, saved_at
    FROM member_role_backups
    WHERE guild_id = ? AND user_id = ?
  `).get(guildId, userId);

  if (!row) {
    return null;
  }

  let roleIds = [];

  try {
    const parsed = JSON.parse(row.role_ids_json);

    if (Array.isArray(parsed)) {
      roleIds = parsed.filter((roleId) =>
        typeof roleId === 'string'
      );
    }
  } catch (error) {
    console.error(
      `Failed to parse role backup for ${userId} in ${guildId}:`,
      error
    );
  }

  return {
    roleIds,
    savedAt: row.saved_at,
  };
}

async function restoreMemberRoles(member) {
  const backup = getMemberRoleBackup(
    member.guild.id,
    member.id
  );

  if (!backup) {
    return {
      found: false,
      restored: [],
      skipped: [],
      failed: [],
      savedAt: null,
    };
  }

  const restored = [];
  const skipped = [];
  const failed = [];

  for (const roleId of backup.roleIds) {
    const role =
      member.guild.roles.cache.get(roleId)
      || await member.guild.roles.fetch(roleId).catch(() => null);

    if (!role) {
      skipped.push({
        roleId,
        reason: 'Role no longer exists',
      });
      continue;
    }

    if (role.managed) {
      skipped.push({
        roleId,
        roleName: role.name,
        reason: 'Managed or integration role',
      });
      continue;
    }

    if (!role.editable) {
      skipped.push({
        roleId,
        roleName: role.name,
        reason: 'Role is above the bot or cannot be managed',
      });
      continue;
    }

    if (member.roles.cache.has(role.id)) {
      skipped.push({
        roleId,
        roleName: role.name,
        reason: 'Member already has this role',
      });
      continue;
    }

    try {
      await member.roles.add(
        role,
        'Restored from saved API role backup'
      );

      restored.push({
        roleId,
        roleName: role.name,
      });
    } catch (error) {
      failed.push({
        roleId,
        roleName: role.name,
        reason: error?.message || 'Unknown error',
      });
    }
  }

  return {
    found: true,
    restored,
    skipped,
    failed,
    savedAt: backup.savedAt,
  };
}

module.exports = {
  saveMemberRoles,
  getMemberRoleBackup,
  restoreMemberRoles,
};
