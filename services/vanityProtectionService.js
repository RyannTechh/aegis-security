const {
  AuditLogEvent,
} = require('discord.js');

const {
  isOwner,
} = require('../utils/checks');

async function findVanityExecutor(guild) {
  const logs = await guild.fetchAuditLogs({
    type: AuditLogEvent.GuildUpdate,
    limit: 8,
  }).catch(() => null);

  if (!logs) {
    return null;
  }

  const now = Date.now();

  return logs.entries.find(
    (entry) =>
      entry.executorId
      && now - entry.createdTimestamp < 20000
      && entry.changes?.some(
        (change) =>
          change.key === 'vanity_url_code'
          || change.key === 'vanity_url'
      )
  ) || null;
}

function isAuthorizedVanityExecutor(guild, executorId) {
  if (!executorId) return false;
  if (executorId === guild.ownerId) return true;
  if (executorId === guild.client.user.id) return true;
  if (isOwner(executorId)) return true;

  return false;
}

async function banVanityExecutor(guild, executorId) {
  if (isAuthorizedVanityExecutor(guild, executorId)) {
    return {
      banned: false,
      reason: 'authorized',
    };
  }

  const member = await guild.members
    .fetch(executorId)
    .catch(() => null);

  if (!member) {
    return {
      banned: false,
      reason: 'member_not_found',
    };
  }

  if (!member.bannable) {
    return {
      banned: false,
      reason: 'not_bannable',
    };
  }

  await member.ban({
    reason:
      'Automatic security action: unauthorized server vanity URL change.',
  });

  return {
    banned: true,
    reason: 'banned',
  };
}

async function restoreVanity(guild, oldVanity) {
  if (!oldVanity) {
    return {
      restored: false,
      reason: 'no_previous_vanity',
    };
  }

  /*
   * Discord.js exposes setVanityCode on Guild when the bot/application
   * has the required server capabilities and permissions.
   */
  if (typeof guild.setVanityCode !== 'function') {
    return {
      restored: false,
      reason: 'setVanityCode_unavailable',
    };
  }

  try {
    await guild.setVanityCode(
      oldVanity,
      'Automatic security action: restore unauthorized vanity change'
    );

    return {
      restored: true,
      reason: 'restored',
    };
  } catch (error) {
    return {
      restored: false,
      reason: error?.message || 'restore_failed',
    };
  }
}

module.exports = {
  findVanityExecutor,
  isAuthorizedVanityExecutor,
  banVanityExecutor,
  restoreVanity,
};
