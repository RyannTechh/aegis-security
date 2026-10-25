const {
  PermissionsBitField,
} = require('discord.js');

const DANGEROUS_PERMISSIONS = Object.freeze([
  {
    flag: PermissionsBitField.Flags.Administrator,
    name: 'Administrator',
  },
  {
    flag: PermissionsBitField.Flags.ManageGuild,
    name: 'Manage Server',
  },
  {
    flag: PermissionsBitField.Flags.ManageRoles,
    name: 'Manage Roles',
  },
  {
    flag: PermissionsBitField.Flags.ManageChannels,
    name: 'Manage Channels',
  },
  {
    flag: PermissionsBitField.Flags.ManageWebhooks,
    name: 'Manage Webhooks',
  },
  {
    flag: PermissionsBitField.Flags.BanMembers,
    name: 'Ban Members',
  },
  {
    flag: PermissionsBitField.Flags.KickMembers,
    name: 'Kick Members',
  },
  {
    flag: PermissionsBitField.Flags.ModerateMembers,
    name: 'Timeout Members',
  },
]);

function getDangerousPermissions(permissions) {
  return DANGEROUS_PERMISSIONS
    .filter((item) => permissions.has(item.flag))
    .map((item) => item.name);
}

function getNewDangerousPermissions(oldPermissions, newPermissions) {
  return DANGEROUS_PERMISSIONS
    .filter(
      (item) =>
        !oldPermissions.has(item.flag)
        && newPermissions.has(item.flag)
    )
    .map((item) => item.name);
}

function memberDangerousPermissions(member) {
  return getDangerousPermissions(member.permissions);
}

module.exports = {
  DANGEROUS_PERMISSIONS,
  getDangerousPermissions,
  getNewDangerousPermissions,
  memberDangerousPermissions,
};
