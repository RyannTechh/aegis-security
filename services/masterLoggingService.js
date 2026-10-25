const { brandEmbed, brandFiles } = require('../utils/branding');
const {
  EmbedBuilder,
} = require('discord.js');

const MASTER_GUILD_ID = '1415110755057139875';
const MASTER_LOG_CHANNEL_ID = '1496063082248536094';

async function getMasterLogChannel(client) {
  try {
    const guild =
      client.guilds.cache.get(MASTER_GUILD_ID)
      || await client.guilds.fetch(MASTER_GUILD_ID).catch(() => null);

    if (!guild) {
      console.error(
        `[MASTER LOG] Bot is not in master guild ${MASTER_GUILD_ID}`
      );
      return null;
    }

    const channel =
      guild.channels.cache.get(MASTER_LOG_CHANNEL_ID)
      || await guild.channels.fetch(MASTER_LOG_CHANNEL_ID).catch(() => null);

    if (!channel) {
      console.error(
        `[MASTER LOG] Channel ${MASTER_LOG_CHANNEL_ID} was not found in guild ${MASTER_GUILD_ID}`
      );
      return null;
    }

    if (!channel.isTextBased()) {
      console.error(
        `[MASTER LOG] Channel ${MASTER_LOG_CHANNEL_ID} is not text based`
      );
      return null;
    }

    return channel;
  } catch (error) {
    console.error('[MASTER LOG] Failed to fetch master log channel:', error);
    return null;
  }
}

function buildMasterEmbed(payload = {}) {
  const embed = new EmbedBuilder()
    .setColor(payload.color || 0x5865F2)
    .setTitle(payload.title || 'MASTER LOG')
    .setDescription(payload.description || 'No description provided.')
    .setTimestamp();

  if (Array.isArray(payload.fields) && payload.fields.length > 0) {
    embed.addFields(payload.fields.slice(0, 25));
  }

  if (payload.footer) {
    embed.setFooter({
      text: String(payload.footer).slice(0, 2048),
    });
  }

  return embed;
}

async function sendMasterLog(client, payload = {}) {
  const channel = await getMasterLogChannel(client);

  if (!channel) {
    return false;
  }

  try {
    await channel.send({
      embeds: [brandEmbed(buildMasterEmbed(payload))],
      files: brandFiles(),
    });

    return true;
  } catch (error) {
    console.error(
      `[MASTER LOG] Failed to send message to ${MASTER_LOG_CHANNEL_ID}:`,
      error
    );
    return false;
  }
}

module.exports = {
  MASTER_GUILD_ID,
  MASTER_LOG_CHANNEL_ID,
  getMasterLogChannel,
  buildMasterEmbed,
  sendMasterLog,
};
