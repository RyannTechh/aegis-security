const {
  Events,
} = require('discord.js');

const {
  saveAutomaticRoleBackup,
} = require('../services/automaticRoleBackupService');

module.exports = {
  name: Events.GuildMemberUpdate,

  async execute(client, oldMember, newMember) {
    const oldRoleIds = oldMember.roles.cache
      .map((role) => role.id)
      .sort()
      .join(',');

    const newRoleIds = newMember.roles.cache
      .map((role) => role.id)
      .sort()
      .join(',');

    if (oldRoleIds === newRoleIds) {
      return;
    }

    try {
      saveAutomaticRoleBackup(newMember);
    } catch (error) {
      console.error(
        `[AUTO ROLE BACKUP] Failed for ${newMember.user.tag} (${newMember.id}):`,
        error
      );
    }
  },
};
