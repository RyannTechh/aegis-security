const { brandEmbed, brandFiles } = require('../utils/branding');
const { EmbedBuilder } = require('discord.js');

async function getLogChannel(client, envName) {
  const channelId = process.env[envName];
  if (!channelId) return null;

  const channel = client.channels.cache.get(channelId)
    || await client.channels.fetch(channelId).catch(() => null);

  return channel?.isTextBased() ? channel : null;
}

async function sendChannelLog(client, envName, options = {}) {
  const channel = await getLogChannel(client, envName);
  if (!channel) return null;

  const embed = new EmbedBuilder()
    .setColor(options.color ?? 0x5865F2)
    .setTitle(options.title ?? 'Log')
    .setDescription(options.description ?? 'No description provided.')
    .setTimestamp();

  if (options.thumbnail) embed.setThumbnail(options.thumbnail);
  if (options.author) embed.setAuthor(options.author);
  if (options.footer) embed.setFooter(options.footer);
  if (Array.isArray(options.fields) && options.fields.length) {
    embed.addFields(options.fields.slice(0, 25));
  }

  return channel.send({
    content: options.content,
    embeds: [brandEmbed(embed)],
    files: brandFiles(),
    components: options.components ?? [],
    allowedMentions: options.allowedMentions ?? { parse: [] },
  }).catch(() => null);
}

module.exports = { getLogChannel, sendChannelLog };
