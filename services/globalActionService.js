const { brandEmbed, brandFiles } = require('../utils/branding');
const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const db = require('../database/database');
const { sendLog } = require('./loggingService');

function cleanUserId(value) {
  const match = String(value || '').match(/\d{17,20}/);
  return match ? match[0] : null;
}

function summarizeResults(results) {
  return {
    successful: results.filter((result) => result.ok && !result.skipped).length,
    skipped: results.filter((result) => result.ok && result.skipped).length,
    failed: results.filter((result) => !result.ok).length,
  };
}

async function sendGlobalBanDM(client, userId, reason, caseId, sourceGuildName) {
  try {
    const user = await client.users.fetch(userId);
    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('You Have Been Globally Banned')
      .setDescription(
        'You have been globally banned from all participating servers connected to this moderation network.'
      )
      .addFields(
        { name: 'Reason', value: reason.slice(0, 1024) },
        { name: 'Ban Case', value: `\`${caseId}\``, inline: true },
        { name: 'Issued From', value: sourceGuildName || 'Unknown server', inline: true }
      )
      .setFooter({ text: 'Contact the issuing server management if you believe this was a mistake.' })
      .setTimestamp();

    await user.send({ embeds: [embed] });
    return true;
  } catch (_) {
    return false;
  }
}

async function globalBan(client, rawUserId, reason, moderatorId, options = {}) {
  const userId = cleanUserId(rawUserId);

  if (!userId) throw new Error('A valid Discord user ID was not provided.');
  if (userId === client.user.id) throw new Error('The bot cannot globally ban itself.');

  const caseId = options.caseId || `GB-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  const dmSent = options.sendDM === false
    ? false
    : await sendGlobalBanDM(client, userId, reason, caseId, options.sourceGuildName);

  const results = [];

  for (const guild of client.guilds.cache.values()) {
    try {
      const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);

      if (!botMember?.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        results.push({ guildId: guild.id, guild: guild.name, ok: false, error: 'Missing Ban Members permission' });
        continue;
      }

      const existingBan = await guild.bans.fetch(userId).catch(() => null);
      if (existingBan) {
        results.push({ guildId: guild.id, guild: guild.name, ok: true, skipped: true, message: 'Already banned' });
        continue;
      }

      const member = await guild.members.fetch(userId).catch(() => null);
      if (member?.id === guild.ownerId) {
        results.push({ guildId: guild.id, guild: guild.name, ok: false, error: 'Cannot ban the server owner' });
        continue;
      }
      if (member && !member.bannable) {
        results.push({ guildId: guild.id, guild: guild.name, ok: false, error: 'Member is above the bot role or not bannable' });
        continue;
      }

      await guild.members.ban(userId, {
        deleteMessageSeconds: 0,
        reason: `${reason} | Case ${caseId} | Staff ${moderatorId}`,
      });

      results.push({ guildId: guild.id, guild: guild.name, ok: true, skipped: false });
    } catch (error) {
      results.push({ guildId: guild.id, guild: guild.name, ok: false, error: error?.message || 'Unknown error' });
    }
  }

  db.prepare(`
    INSERT OR REPLACE INTO global_bans
    (user_id, reason, added_by, created_at)
    VALUES (?, ?, ?, ?)
  `).run(userId, reason, moderatorId, Date.now());

  const totals = summarizeResults(results);
  await sendLog(client, {
    title: 'Global Ban Executed',
    description: `<@${userId}> (\`${userId}\`) was globally banned.`,
    fields: [
      { name: 'Case', value: `\`${caseId}\``, inline: true },
      { name: 'Moderator', value: `<@${moderatorId}>`, inline: true },
      { name: 'DM Sent', value: dmSent ? 'Yes' : 'No', inline: true },
      { name: 'Reason', value: reason.slice(0, 1024) },
      { name: 'Banned', value: String(totals.successful), inline: true },
      { name: 'Already Banned', value: String(totals.skipped), inline: true },
      { name: 'Failed', value: String(totals.failed), inline: true },
    ],
    color: 0xED4245,
  }, true);

  return { results, dmSent, caseId };
}

async function globalUnban(client, rawUserId, reason) {
  const userId = cleanUserId(rawUserId);
  if (!userId) throw new Error('A valid Discord user ID was not provided.');

  const globalBlocked = db.prepare('SELECT 1 FROM global_blacklists WHERE user_id = ?').get(userId);
  if (globalBlocked) throw new Error('This user is globally blacklisted and cannot be globally unbanned.');

  const results = [];
  for (const guild of client.guilds.cache.values()) {
    try {
      const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
      if (!botMember?.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        results.push({ guildId: guild.id, guild: guild.name, ok: false, error: 'Missing Ban Members permission' });
        continue;
      }

      const existingBan = await guild.bans.fetch(userId).catch(() => null);
      if (!existingBan) {
        results.push({ guildId: guild.id, guild: guild.name, ok: true, skipped: true, message: 'Not banned' });
        continue;
      }

      await guild.bans.remove(userId, reason);
      results.push({ guildId: guild.id, guild: guild.name, ok: true, skipped: false });
    } catch (error) {
      results.push({ guildId: guild.id, guild: guild.name, ok: false, error: error?.message || 'Unknown error' });
    }
  }

  db.prepare('DELETE FROM global_bans WHERE user_id = ?').run(userId);
  return results;
}

async function globalKick(client, rawUserId, reason) {
  const userId = cleanUserId(rawUserId);
  if (!userId) throw new Error('A valid Discord user ID was not provided.');

  const results = [];
  for (const guild of client.guilds.cache.values()) {
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        results.push({ guildId: guild.id, guild: guild.name, ok: true, skipped: true, message: 'Not in server' });
        continue;
      }
      if (!member.kickable) {
        results.push({ guildId: guild.id, guild: guild.name, ok: false, error: 'Member is not kickable' });
        continue;
      }
      await member.kick(reason);
      results.push({ guildId: guild.id, guild: guild.name, ok: true, skipped: false });
    } catch (error) {
      results.push({ guildId: guild.id, guild: guild.name, ok: false, error: error?.message || 'Unknown error' });
    }
  }
  return results;
}

async function globalStrip(client, rawUserId, reason) {
  const userId = cleanUserId(rawUserId);
  if (!userId) throw new Error('A valid Discord user ID was not provided.');

  const results = [];
  for (const guild of client.guilds.cache.values()) {
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        results.push({ guildId: guild.id, guild: guild.name, ok: true, skipped: true, message: 'Not in server' });
        continue;
      }
      const roles = member.roles.cache.filter((role) => role.id !== guild.id && role.editable && !role.managed);
      if (roles.size) await member.roles.remove(roles, reason);
      results.push({ guildId: guild.id, guild: guild.name, ok: true, skipped: roles.size === 0, removed: roles.size });
    } catch (error) {
      results.push({ guildId: guild.id, guild: guild.name, ok: false, error: error?.message || 'Unknown error' });
    }
  }
  return results;
}

module.exports = {
  cleanUserId,
  summarizeResults,
  sendGlobalBanDM,
  globalBan,
  globalUnban,
  globalKick,
  globalStrip,
};
