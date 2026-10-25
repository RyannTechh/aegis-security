const db = require('../database/database');
const { isOwner } = require('../utils/checks');

/*
 * Detects Discord invite links in normal and edited messages.
 *
 * Owners and users with any bot whitelist permission are allowed
 * to post Discord invite links.
 *
 * Covered examples:
 * discord.gg/example
 * https://discord.gg/example
 * http://discord.gg/example
 * discord.com/invite/example
 * https://discord.com/invite/example
 * discordapp.com/invite/example
 * https://discord/gg/example
 * discord . gg/example
 * discord[.]gg/example
 */

const DISCORD_INVITE_PATTERN =
  /(?:https?:\/\/)?(?:www\.)?(?:discord(?:app)?\.com\/invite|discord\.gg|discord\/gg)\/?[a-z0-9-]+/i;

function normalizeMessageContent(content) {
  return String(content || '')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/\[\s*\.\s*\]/g, '.')
    .replace(/\s*([.:/])\s*/g, '$1')
    .trim();
}

function containsDiscordInvite(content) {
  const normalized = normalizeMessageContent(content);
  return DISCORD_INVITE_PATTERN.test(normalized);
}

function isBotWhitelisted(guildId, userId) {
  const row = db.prepare(`
    SELECT 1
    FROM whitelists
    WHERE guild_id = ?
      AND user_id = ?
    LIMIT 1
  `).get(guildId, userId);

  return Boolean(row);
}

function canPostDiscordInvites(guildId, userId) {
  return (
    isOwner(userId)
    || isBotWhitelisted(guildId, userId)
  );
}

async function handleDiscordInviteMessage(message) {
  if (!message?.guild) {
    return false;
  }

  if (!message.author || message.author.bot || message.webhookId) {
    return false;
  }

  if (!containsDiscordInvite(message.content)) {
    return false;
  }

  if (canPostDiscordInvites(message.guild.id, message.author.id)) {
    return false;
  }

  const deleted = await message.delete().then(
    () => true,
    (error) => {
      console.error(
        `Failed to delete invite link in ${message.guild.name} (${message.guild.id}):`,
        error
      );

      return false;
    }
  );

  if (!deleted) {
    return false;
  }

  const warning = await message.channel.send({
    content:
      `${message.author}, Discord invite links are not allowed in this server.`,
    allowedMentions: {
      users: [message.author.id],
    },
  }).catch((error) => {
    console.error(
      `Failed to send invite-link warning in ${message.guild.name}:`,
      error
    );

    return null;
  });

  if (warning) {
    setTimeout(() => {
      warning.delete().catch(() => null);
    }, 7500);
  }

  return true;
}

module.exports = {
  DISCORD_INVITE_PATTERN,
  normalizeMessageContent,
  containsDiscordInvite,
  isBotWhitelisted,
  canPostDiscordInvites,
  handleDiscordInviteMessage,
};
