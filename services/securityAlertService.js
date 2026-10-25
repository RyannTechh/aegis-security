const { brandEmbed, brandFiles } = require('../utils/branding');
const {
  EmbedBuilder,
} = require('discord.js');

const {
  parseIds,
} = require('../utils/checks');

const SECURITY_ALERT_CHANNEL_ID = '1538668312744038470';

async function getSecurityAlertChannel(client) {
  const channel =
    client.channels.cache.get(SECURITY_ALERT_CHANNEL_ID)
    || await client.channels.fetch(SECURITY_ALERT_CHANNEL_ID).catch(() => null);

  if (!channel?.isTextBased()) {
    console.error(
      `[SECURITY ALERTS] Channel ${SECURITY_ALERT_CHANNEL_ID} is unavailable or is not text based.`
    );
    return null;
  }

  return channel;
}

async function sendSecurityAlert(client, payload = {}) {
  const channel = await getSecurityAlertChannel(client);
  if (!channel) return false;

  const ownerIds = parseIds(process.env.OWNER_IDS);
  const ownerMentions = ownerIds.map((id) => `<@${id}>`).join(' ');

  const embed = new EmbedBuilder()
    .setColor(payload.color || 0xED4245)
    .setTitle(payload.title || 'Security Alert')
    .setDescription(payload.description || 'A security event was detected.')
    .setTimestamp();

  if (Array.isArray(payload.fields) && payload.fields.length > 0) {
    embed.addFields(payload.fields.slice(0, 25));
  }

  if (payload.footer) {
    embed.setFooter({
      text: String(payload.footer).slice(0, 2048),
    });
  }

  await channel.send({
    content: ownerMentions || undefined,
    embeds: [brandEmbed(embed)],
    files: brandFiles(),
    allowedMentions: {
      users: ownerIds,
    },
  }).catch((error) => {
    console.error('[SECURITY ALERTS] Failed to send alert:', error);
  });

  return true;
}

module.exports = {
  SECURITY_ALERT_CHANNEL_ID,
  getSecurityAlertChannel,
  sendSecurityAlert,
};
