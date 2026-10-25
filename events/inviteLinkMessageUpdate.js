const { Events } = require('discord.js');
const {
  handleDiscordInviteMessage,
} = require('../services/discordInviteFilterService');

module.exports = {
  name: Events.MessageUpdate,

  async execute(client, oldMessage, newMessage) {
    try {
      if (newMessage.partial) {
        await newMessage.fetch().catch(() => null);
      }

      await handleDiscordInviteMessage(newMessage);
    } catch (error) {
      console.error(
        `Failed to process edited Discord invite in ${newMessage.guild?.name || 'unknown guild'}:`,
        error
      );
    }
  },
};
