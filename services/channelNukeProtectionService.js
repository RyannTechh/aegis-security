const {
  AuditLogEvent,
  ChannelType,
} = require('discord.js');

const {
  isOwner,
} = require('../utils/checks');

const {
  roleStripMember,
} = require('./securityPunishmentService');

const {
  sendSecurityAlert,
} = require('./securityAlertService');

const DELETE_THRESHOLD = 3;
const WINDOW_MS = 10_000;

const deletionWindows = new Map();

function snapshotDeletedChannel(channel) {
  return {
    oldId: channel.id,
    name: channel.name,
    type: channel.type,
    parentId: channel.parentId || null,
    position: channel.rawPosition ?? channel.position ?? 0,
    topic: 'topic' in channel ? channel.topic : null,
    nsfw: 'nsfw' in channel ? Boolean(channel.nsfw) : false,
    rateLimitPerUser:
      'rateLimitPerUser' in channel
        ? channel.rateLimitPerUser
        : null,
    bitrate:
      'bitrate' in channel
        ? channel.bitrate
        : null,
    userLimit:
      'userLimit' in channel
        ? channel.userLimit
        : null,
    rtcRegion:
      'rtcRegion' in channel
        ? channel.rtcRegion
        : null,
    videoQualityMode:
      'videoQualityMode' in channel
        ? channel.videoQualityMode
        : null,
    permissionOverwrites: channel.permissionOverwrites.cache.map((overwrite) => ({
      id: overwrite.id,
      type: overwrite.type,
      allow: overwrite.allow.bitfield.toString(),
      deny: overwrite.deny.bitfield.toString(),
    })),
  };
}

function makeWindowKey(guildId, executorId) {
  return `${guildId}:${executorId}`;
}

function registerDeletion(guildId, executorId, snapshot) {
  const key = makeWindowKey(guildId, executorId);
  const now = Date.now();

  const current = deletionWindows.get(key) || [];

  const filtered = current.filter(
    (entry) => now - entry.timestamp <= WINDOW_MS
  );

  filtered.push({
    timestamp: now,
    snapshot,
  });

  deletionWindows.set(key, filtered);

  setTimeout(() => {
    const latest = deletionWindows.get(key) || [];
    const fresh = latest.filter(
      (entry) => Date.now() - entry.timestamp <= WINDOW_MS
    );

    if (fresh.length === 0) {
      deletionWindows.delete(key);
    } else {
      deletionWindows.set(key, fresh);
    }
  }, WINDOW_MS + 1000).unref?.();

  return filtered;
}

function clearDeletionWindow(guildId, executorId) {
  deletionWindows.delete(
    makeWindowKey(guildId, executorId)
  );
}

async function findChannelDeleteExecutor(guild, channelId) {
  const logs = await guild.fetchAuditLogs({
    type: AuditLogEvent.ChannelDelete,
    limit: 8,
  }).catch(() => null);

  if (!logs) {
    return null;
  }

  return logs.entries.find(
    (entry) =>
      entry.target?.id === channelId
      && entry.executorId
      && Date.now() - entry.createdTimestamp < 15_000
  ) || null;
}

function buildPermissionOverwrites(guild, saved) {
  return saved.permissionOverwrites
    .map((overwrite) => ({
      id: overwrite.id,
      type: overwrite.type,
      allow: BigInt(overwrite.allow),
      deny: BigInt(overwrite.deny),
    }))
    .filter((overwrite) =>
      overwrite.id === guild.id
      || guild.roles.cache.has(overwrite.id)
      || guild.members.cache.has(overwrite.id)
    );
}

async function restoreDeletedChannel(guild, saved) {
  let parent = null;

  if (saved.parentId) {
    parent =
      guild.channels.cache.get(saved.parentId)
      || await guild.channels.fetch(saved.parentId).catch(() => null);
  }

  const options = {
    name: saved.name,
    type: saved.type,
    parent: parent?.id || undefined,
    permissionOverwrites:
      buildPermissionOverwrites(guild, saved),
    reason: 'Automatic anti-channel-nuke restore',
  };

  if (
    saved.type === ChannelType.GuildText
    || saved.type === ChannelType.GuildAnnouncement
  ) {
    options.topic = saved.topic || undefined;
    options.nsfw = saved.nsfw;
    options.rateLimitPerUser =
      saved.rateLimitPerUser ?? undefined;
  }

  if (
    saved.type === ChannelType.GuildVoice
    || saved.type === ChannelType.GuildStageVoice
  ) {
    options.bitrate = saved.bitrate || undefined;
    options.userLimit = saved.userLimit ?? undefined;
    options.rtcRegion = saved.rtcRegion || undefined;
    options.videoQualityMode =
      saved.videoQualityMode ?? undefined;
  }

  const restored = await guild.channels.create(options);

  await restored.setPosition(saved.position).catch(() => null);

  return restored;
}

async function handleChannelDeletion(client, channel) {
  const guild = channel.guild;
  if (!guild) return;

  const snapshot = snapshotDeletedChannel(channel);

  await new Promise((resolve) =>
    setTimeout(resolve, 900)
  );

  const auditEntry = await findChannelDeleteExecutor(
    guild,
    channel.id
  );

  const executorId = auditEntry?.executorId;

  if (!executorId) {
    await sendSecurityAlert(client, {
      title: 'SECURITY • Channel Deleted',
      description:
        'A channel was deleted, but the executor could not be identified.',
      fields: [
        {
          name: 'Channel',
          value: `#${snapshot.name}\n\`${snapshot.oldId}\``,
        },
        {
          name: 'Server',
          value: `${guild.name}\n\`${guild.id}\``,
        },
      ],
      color: 0xFEE75C,
    });

    return;
  }

  if (
    executorId === guild.ownerId
    || executorId === client.user.id
    || isOwner(executorId)
  ) {
    return;
  }

  const window = registerDeletion(
    guild.id,
    executorId,
    snapshot
  );

  if (window.length < DELETE_THRESHOLD) {
    return;
  }

  const executorMember = await guild.members
    .fetch(executorId)
    .catch(() => null);

  const punishment = await roleStripMember(
    executorMember,
    `Automatic anti-channel-nuke: ${window.length} channel deletions in ${WINDOW_MS / 1000}s`
  ).catch((error) => ({
    success: false,
    removed: 0,
    reason: error?.message || 'role_strip_failed',
  }));

  let restored = 0;
  const restoreFailures = [];

  /*
   * Restore every deleted channel currently in this executor's
   * detection window.
   */
  for (const entry of window) {
    try {
      await restoreDeletedChannel(
        guild,
        entry.snapshot
      );

      restored++;
    } catch (error) {
      restoreFailures.push({
        name: entry.snapshot.name,
        error: error?.message || 'Unknown error',
      });
    }
  }

  clearDeletionWindow(
    guild.id,
    executorId
  );

  await sendSecurityAlert(client, {
    title: 'SECURITY • Channel Nuke Detected',
    description:
      `A user deleted **${window.length} channels** within **${WINDOW_MS / 1000} seconds**.`,
    fields: [
      {
        name: 'Executor',
        value: `<@${executorId}>\n\`${executorId}\``,
      },
      {
        name: 'Server',
        value: `${guild.name}\n\`${guild.id}\``,
      },
      {
        name: 'Roles Removed',
        value: String(punishment.removed || 0),
        inline: true,
      },
      {
        name: 'Channels Restored',
        value: String(restored),
        inline: true,
      },
      {
        name: 'Restore Failures',
        value: String(restoreFailures.length),
        inline: true,
      },
    ],
    color: 0xED4245,
  });
}

module.exports = {
  DELETE_THRESHOLD,
  WINDOW_MS,
  snapshotDeletedChannel,
  findChannelDeleteExecutor,
  restoreDeletedChannel,
  handleChannelDeletion,
};
