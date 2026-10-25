const {
  Events,
} = require('discord.js');

const {
  saveMemberRoles,
} = require('../services/memberRoleBackupService');

module.exports = {
  name: Events.GuildMemberRemove,

  async execute(client, member) {
    try {
      const result = saveMemberRoles(member);

      console.log(
        `Saved ${result.roleIds.length} role(s) for `
        + `${member.user.tag} (${member.id}) in `
        + `${member.guild.name} (${member.guild.id}).`
      );
    } catch (error) {
      console.error(
        `Failed to save roles for ${member?.id || 'unknown user'} `
        + `in ${member?.guild?.id || 'unknown guild'}:`,
        error
      );
    }
  },
};
