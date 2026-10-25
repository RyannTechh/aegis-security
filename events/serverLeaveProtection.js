const {
  Events,
} = require('discord.js');

const {
  sendSecurityAlert,
} = require('../services/securityAlertService');

module.exports = {
  name: Events.GuildDelete,

  async execute(client, guild) {
    /*
     * Once the bot has been removed from a guild, Discord no longer gives
     * the bot access to that guild's audit log. We can reliably alert that
     * the bot left/was removed, but we cannot always identify who removed it.
     */
    await sendSecurityAlert(client, {
      title: 'SECURITY • Bot Removed From Server',
      description:
        'The bot is no longer connected to a server. This can mean the bot was kicked, the server was deleted, or the bot was intentionally made to leave.',
      fields: [
        {
          name: 'Server',
          value: `${guild.name || 'Unknown Server'}\n\`${guild.id}\``,
          inline: false,
        },
        {
          name: 'Member Count',
          value: guild.memberCount
            ? String(guild.memberCount)
            : 'Unknown',
          inline: true,
        },
        {
          name: 'Time',
          value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: true,
        },
      ],
      color: 0xED4245,
    });
  },
};
