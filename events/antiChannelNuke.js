const {
  Events,
} = require('discord.js');

const {
  handleChannelDeletion,
} = require('../services/channelNukeProtectionService');

module.exports = {
  name: Events.ChannelDelete,

  async execute(client, channel) {
    try {
      await handleChannelDeletion(
        client,
        channel
      );
    } catch (error) {
      console.error(
        `[ANTI CHANNEL NUKE] Failed in ${channel.guild?.name || 'unknown guild'}:`,
        error
      );
    }
  },
};
