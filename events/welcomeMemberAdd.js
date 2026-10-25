const {
  Events,
} = require('discord.js');

const {
  sendWelcomeMessage,
} = require('../services/welcomeService');

module.exports = {
  name: Events.GuildMemberAdd,

  async execute(client, member) {
    try {
      await sendWelcomeMessage(member);
    } catch (error) {
      console.error(
        `Failed to send welcome message in ${member.guild.name} (${member.guild.id}):`,
        error
      );
    }
  },
};
