const {
  Events,
} = require('discord.js');

const {
  sendMasterLog,
  MASTER_GUILD_ID,
  MASTER_LOG_CHANNEL_ID,
} = require('../services/masterLoggingService');

module.exports = {
  name: Events.ClientReady,

  async execute(client) {
    const sent = await sendMasterLog(client, {
      title: 'MASTER LOG • Logger Online',
      description:
        `Master logging is online.\n\n`
        + `Logging Guild: \`${MASTER_GUILD_ID}\`\n`
        + `Logging Channel: <#${MASTER_LOG_CHANNEL_ID}>`,
      fields: [
        {
          name: 'Bot',
          value: `${client.user.tag}\n\`${client.user.id}\``,
          inline: true,
        },
        {
          name: 'Connected Servers',
          value: String(client.guilds.cache.size),
          inline: true,
        },
      ],
      color: 0x57F287,
    });

    if (!sent) {
      console.error(
        '[MASTER LOG] Startup test failed. Check that the bot is in guild '
        + `${MASTER_GUILD_ID}, can see channel ${MASTER_LOG_CHANNEL_ID}, `
        + 'and has View Channel, Send Messages, and Embed Links.'
      );
    }
  },
};
