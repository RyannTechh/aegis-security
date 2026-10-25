const {
  PermissionsBitField,
} = require('discord.js');

const db = require('../database/database');

db.exec(`
  CREATE TABLE IF NOT EXISTS panic_role_backups (
    guild_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    permissions TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, role_id)
  );

  CREATE TABLE IF NOT EXISTS panic_state (
    guild_id TEXT PRIMARY KEY,
    active INTEGER NOT NULL DEFAULT 0,
    started_by TEXT,
    started_at INTEGER
  );
`);

const DANGEROUS_PERMISSIONS = [
  PermissionsBitField.Flags.Administrator,
  PermissionsBitField.Flags.ManageGuild,
  PermissionsBitField.Flags.ManageRoles,
  PermissionsBitField.Flags.ManageChannels,
  PermissionsBitField.Flags.ManageWebhooks,
  PermissionsBitField.Flags.BanMembers,
  PermissionsBitField.Flags.KickMembers,
  PermissionsBitField.Flags.ModerateMembers,
];

function hasDangerousPermissions(role) {
  return DANGEROUS_PERMISSIONS.some((permission) =>
    role.permissions.has(permission)
  );
}

function removeDangerousPermissions(role) {
  const permissions = new PermissionsBitField(
    role.permissions.bitfield
  );

  for (const permission of DANGEROUS_PERMISSIONS) {
    permissions.remove(permission);
  }

  return permissions;
}

function getPanicState(guildId) {
  return db.prepare(`
    SELECT *
    FROM panic_state
    WHERE guild_id = ?
  `).get(guildId) || {
    guild_id: guildId,
    active: 0,
    started_by: null,
    started_at: null,
  };
}

async function activatePanic(guild, ownerId) {
  const current = getPanicState(guild.id);

  if (current.active) {
    return {
      alreadyActive: true,
      changed: 0,
      skipped: 0,
      failed: [],
    };
  }

  const botMember =
    guild.members.me
    || await guild.members.fetchMe().catch(() => null);

  if (!botMember) {
    throw new Error('Could not fetch the bot member.');
  }

  const dangerousRoles = guild.roles.cache.filter((role) =>
    role.id !== guild.id
    && !role.managed
    && role.id !== botMember.roles.highest.id
    && role.position < botMember.roles.highest.position
    && hasDangerousPermissions(role)
  );

  const saveBackup = db.prepare(`
    INSERT OR REPLACE INTO panic_role_backups (
      guild_id,
      role_id,
      permissions,
      created_by,
      created_at
    )
    VALUES (?, ?, ?, ?, ?)
  `);

  let changed = 0;
  let skipped = 0;
  const failed = [];

  for (const role of dangerousRoles.values()) {
    try {
      saveBackup.run(
        guild.id,
        role.id,
        role.permissions.bitfield.toString(),
        ownerId,
        Date.now()
      );

      const safePermissions = removeDangerousPermissions(role);

      await role.setPermissions(
        safePermissions,
        `Emergency panic activated by ${ownerId}`
      );

      changed++;
    } catch (error) {
      failed.push({
        roleId: role.id,
        roleName: role.name,
        error: error?.message || 'Unknown error',
      });
    }
  }

  db.prepare(`
    INSERT OR REPLACE INTO panic_state (
      guild_id,
      active,
      started_by,
      started_at
    )
    VALUES (?, 1, ?, ?)
  `).run(
    guild.id,
    ownerId,
    Date.now()
  );

  return {
    alreadyActive: false,
    changed,
    skipped,
    failed,
  };
}

async function restorePanic(guild, ownerId) {
  const current = getPanicState(guild.id);

  if (!current.active) {
    return {
      notActive: true,
      restored: 0,
      skipped: 0,
      failed: [],
    };
  }

  const rows = db.prepare(`
    SELECT role_id, permissions
    FROM panic_role_backups
    WHERE guild_id = ?
    ORDER BY created_at ASC
  `).all(guild.id);

  let restored = 0;
  let skipped = 0;
  const failed = [];

  for (const row of rows) {
    const role =
      guild.roles.cache.get(row.role_id)
      || await guild.roles.fetch(row.role_id).catch(() => null);

    if (!role) {
      skipped++;
      continue;
    }

    if (role.managed || !role.editable) {
      skipped++;
      continue;
    }

    try {
      await role.setPermissions(
        BigInt(row.permissions),
        `Emergency panic restored by ${ownerId}`
      );

      restored++;
    } catch (error) {
      failed.push({
        roleId: role.id,
        roleName: role.name,
        error: error?.message || 'Unknown error',
      });
    }
  }

  db.prepare(`
    DELETE FROM panic_role_backups
    WHERE guild_id = ?
  `).run(guild.id);

  db.prepare(`
    INSERT OR REPLACE INTO panic_state (
      guild_id,
      active,
      started_by,
      started_at
    )
    VALUES (?, 0, NULL, NULL)
  `).run(guild.id);

  return {
    notActive: false,
    restored,
    skipped,
    failed,
  };
}

module.exports = {
  DANGEROUS_PERMISSIONS,
  hasDangerousPermissions,
  getPanicState,
  activatePanic,
  restorePanic,
};
