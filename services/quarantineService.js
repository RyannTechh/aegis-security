const db = require('../database/database');

db.exec(`
  CREATE TABLE IF NOT EXISTS quarantine_backups (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role_ids_json TEXT NOT NULL,
    quarantined_by TEXT NOT NULL,
    quarantined_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, user_id)
  );
`);

function getQuarantineRoleId() {
  return String(process.env.QUARANTINE_ROLE_ID || '').trim();
}

function getQuarantineBackup(guildId, userId) {
  const row = db.prepare(`
    SELECT role_ids_json, quarantined_by, quarantined_at
    FROM quarantine_backups
    WHERE guild_id = ? AND user_id = ?
  `).get(guildId, userId);

  if (!row) return null;

  let roleIds = [];

  try {
    const parsed = JSON.parse(row.role_ids_json);
    if (Array.isArray(parsed)) {
      roleIds = parsed.filter((id) => typeof id === 'string');
    }
  } catch (_) {}

  return {
    roleIds,
    quarantinedBy: row.quarantined_by,
    quarantinedAt: row.quarantined_at,
  };
}

function saveQuarantineBackup(member, moderatorId) {
  const quarantineRoleId = getQuarantineRoleId();

  const roleIds = member.roles.cache
    .filter((role) =>
      role.id !== member.guild.id
      && role.id !== quarantineRoleId
      && !role.managed
    )
    .map((role) => role.id);

  db.prepare(`
    INSERT OR REPLACE INTO quarantine_backups (
      guild_id,
      user_id,
      role_ids_json,
      quarantined_by,
      quarantined_at
    )
    VALUES (?, ?, ?, ?, ?)
  `).run(
    member.guild.id,
    member.id,
    JSON.stringify(roleIds),
    moderatorId,
    Date.now()
  );

  return roleIds;
}

function clearQuarantineBackup(guildId, userId) {
  db.prepare(`
    DELETE FROM quarantine_backups
    WHERE guild_id = ? AND user_id = ?
  `).run(guildId, userId);
}

async function quarantineMember(member, moderatorId, reason) {
  const quarantineRoleId = getQuarantineRoleId();

  if (!quarantineRoleId) {
    throw new Error('QUARANTINE_ROLE_ID is not configured in .env.');
  }

  const quarantineRole =
    member.guild.roles.cache.get(quarantineRoleId)
    || await member.guild.roles.fetch(quarantineRoleId).catch(() => null);

  if (!quarantineRole) {
    throw new Error('The configured quarantine role does not exist in this server.');
  }

  if (!quarantineRole.editable) {
    throw new Error('The bot cannot manage the configured quarantine role.');
  }

  const existing = getQuarantineBackup(member.guild.id, member.id);

  if (!existing) {
    saveQuarantineBackup(member, moderatorId);
  }

  const removableRoles = member.roles.cache.filter((role) =>
    role.id !== member.guild.id
    && role.id !== quarantineRoleId
    && !role.managed
    && role.editable
  );

  if (removableRoles.size > 0) {
    await member.roles.remove(
      removableRoles,
      reason || `Quarantined by ${moderatorId}`
    );
  }

  if (!member.roles.cache.has(quarantineRole.id)) {
    await member.roles.add(
      quarantineRole,
      reason || `Quarantined by ${moderatorId}`
    );
  }

  return {
    removed: removableRoles.size,
    quarantineRoleId,
    alreadyQuarantined: Boolean(existing),
  };
}

async function unquarantineMember(member, moderatorId, reason) {
  const quarantineRoleId = getQuarantineRoleId();

  if (!quarantineRoleId) {
    throw new Error('QUARANTINE_ROLE_ID is not configured in .env.');
  }

  const backup = getQuarantineBackup(member.guild.id, member.id);

  if (!backup) {
    throw new Error('No quarantine backup exists for this member.');
  }

  const quarantineRole =
    member.guild.roles.cache.get(quarantineRoleId)
    || await member.guild.roles.fetch(quarantineRoleId).catch(() => null);

  if (quarantineRole?.editable && member.roles.cache.has(quarantineRole.id)) {
    await member.roles.remove(
      quarantineRole,
      reason || `Unquarantined by ${moderatorId}`
    ).catch(() => null);
  }

  const rolesToRestore = [];
  const skipped = [];

  for (const roleId of backup.roleIds) {
    const role =
      member.guild.roles.cache.get(roleId)
      || await member.guild.roles.fetch(roleId).catch(() => null);

    if (!role) {
      skipped.push({ roleId, reason: 'Role no longer exists' });
      continue;
    }

    if (role.managed || !role.editable) {
      skipped.push({
        roleId,
        roleName: role.name,
        reason: 'Bot cannot manage role',
      });
      continue;
    }

    if (!member.roles.cache.has(role.id)) {
      rolesToRestore.push(role);
    }
  }

  if (rolesToRestore.length > 0) {
    await member.roles.add(
      rolesToRestore,
      reason || `Quarantine roles restored by ${moderatorId}`
    );
  }

  clearQuarantineBackup(member.guild.id, member.id);

  return {
    restored: rolesToRestore.length,
    skipped,
  };
}

module.exports = {
  getQuarantineRoleId,
  getQuarantineBackup,
  saveQuarantineBackup,
  clearQuarantineBackup,
  quarantineMember,
  unquarantineMember,
};
