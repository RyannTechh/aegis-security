const { brandEmbed, brandFiles } = require('../utils/branding');
const { EmbedBuilder } = require('discord.js');

const {
  sendMasterLog,
} = require('./masterLoggingService');

async function getTextChannel(client, channelId) {
  if (!channelId) return null;

  const channel =
    client.channels.cache.get(channelId)
    || await client.channels.fetch(channelId).catch(() => null);

  if (!channel?.isTextBased()) {
    return null;
  }

  return channel;
}

function buildNormalEmbed(payload = {}) {
  const embed = new EmbedBuilder()
    .setColor(payload.color || 0x5865F2)
    .setTitle(payload.title || 'Bot Log')
    .setDescription(payload.description || 'No description')
    .setTimestamp();

  if (Array.isArray(payload.fields) && payload.fields.length > 0) {
    embed.addFields(payload.fields.slice(0, 25));
  }

  return embed;
}

async function sendLog(client, payload, global = false) {
  const channelId = global
    ? process.env.GLOBAL_LOG_CHANNEL_ID
    : process.env.LOG_CHANNEL_ID;

  const normalChannel = await getTextChannel(client, channelId);

  if (normalChannel) {
    await normalChannel.send({
      embeds: [brandEmbed(buildNormalEmbed(payload))],
      files: brandFiles(),
    }).catch((error) => {
      console.error('[LOGGING] Failed to send normal log:', error);
    });
  }

  // ALWAYS make a separate copy in the master logging server.
  await sendMasterLog(client, {
    title: `MASTER LOG • ${payload?.title || 'Bot Log'}`,
    description: payload?.description || 'No description',
    fields: payload?.fields || [],
    color: payload?.color || 0x5865F2,
  });
}

module.exports = {
  sendLog,
};
