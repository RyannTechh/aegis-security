const { Events } = require('discord.js');
const {
  handleDiscordInviteMessage,
} = require('../services/discordInviteFilterService');

module.exports = {
  name: Events.MessageCreate,

  async execute(client, message) {
    try {
      await handleDiscordInviteMessage(message);
    } catch (error) {
      console.error(
        `Failed to process Discord invite filter in ${message.guild?.name || 'unknown guild'}:`,
        error
      );
    }
  },
};
