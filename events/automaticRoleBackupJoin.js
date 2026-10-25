const {
  Events,
} = require('discord.js');

const {
  saveAutomaticRoleBackup,
} = require('../services/automaticRoleBackupService');

module.exports = {
  name: Events.GuildMemberAdd,

  async execute(client, member) {
    if (member.user.bot) return;

    /*
     * Save the current state on join. Later role changes keep it updated.
     * This does NOT automatically restore roles on join; your existing /api
     * system can still be used for explicit restoration.
     */
    try {
      saveAutomaticRoleBackup(member);
    } catch (error) {
      console.error(
        `[AUTO ROLE BACKUP] Join backup failed for ${member.user.tag} (${member.id}):`,
        error
      );
    }
  },
};
