const db = require('../database/database');
const { ChannelType, PermissionsBitField } = require('discord.js');

function serializePermissions(overwrite) {
  return {
    id: overwrite.id,
    type: overwrite.type,
    allow: overwrite.allow.bitfield.toString(),
    deny: overwrite.deny.bitfield.toString(),
  };
}

function makeSnapshot(guild) {
  const roles = guild.roles.cache
    .filter((role) => role.id !== guild.id && !role.managed)
    .sort((a, b) => a.position - b.position)
    .map((role) => ({
      oldId: role.id,
      name: role.name,
      color: role.color,
      hoist: role.hoist,
      permissions: role.permissions.bitfield.toString(),
      mentionable: role.mentionable,
      position: role.position,
    }));

  const channels = guild.channels.cache
    .sort((a, b) => a.rawPosition - b.rawPosition)
    .map((channel) => ({
      oldId: channel.id,
      name: channel.name,
      type: channel.type,
      parentId: channel.parentId,
      position: channel.rawPosition,
      topic: 'topic' in channel ? channel.topic : null,
      nsfw: 'nsfw' in channel ? channel.nsfw : false,
      bitrate: 'bitrate' in channel ? channel.bitrate : null,
      userLimit: 'userLimit' in channel ? channel.userLimit : null,
      permissionOverwrites: channel.permissionOverwrites.cache.map(serializePermissions),
    }));

  return { roles, channels, savedAt: Date.now() };
}

function saveSnapshot(guild, userId) {
  const snapshot = makeSnapshot(guild);
  db.prepare(`
    INSERT OR REPLACE INTO guild_backups
    (guild_id, snapshot_json, created_by, created_at)
    VALUES (?, ?, ?, ?)
  `).run(guild.id, JSON.stringify(snapshot), userId, Date.now());
  return snapshot;
}

async function restoreSnapshot(guild) {
  const row = db.prepare(
    'SELECT snapshot_json FROM guild_backups WHERE guild_id = ?'
  ).get(guild.id);

  if (!row) throw new Error('No saved backup exists for this server.');

  const snapshot = JSON.parse(row.snapshot_json);
  const roleMap = new Map();
  let restoredRoles = 0;
  let restoredChannels = 0;

  for (const saved of snapshot.roles) {
    let role = guild.roles.cache.find((r) => r.name === saved.name && !r.managed);
    if (!role) {
      role = await guild.roles.create({
        name: saved.name,
        color: saved.color,
        hoist: saved.hoist,
        permissions: BigInt(saved.permissions),
        mentionable: saved.mentionable,
        reason: 'API restore',
      });
      restoredRoles++;
    }
    roleMap.set(saved.oldId, role.id);
  }

  const channelMap = new Map();
  const categories = snapshot.channels.filter((c) => c.type === ChannelType.GuildCategory);
  const others = snapshot.channels.filter((c) => c.type !== ChannelType.GuildCategory);

  for (const saved of [...categories, ...others]) {
    let channel = guild.channels.cache.find(
      (c) => c.name === saved.name && c.type === saved.type
    );

    if (!channel) {
      const parent = saved.parentId ? channelMap.get(saved.parentId) : null;
      const overwrites = saved.permissionOverwrites
        .map((ow) => ({
          id: roleMap.get(ow.id) || ow.id,
          type: ow.type,
          allow: BigInt(ow.allow),
          deny: BigInt(ow.deny),
        }))
        .filter((ow) => guild.roles.cache.has(ow.id) || guild.members.cache.has(ow.id) || ow.id === guild.id);

      channel = await guild.channels.create({
        name: saved.name,
        type: saved.type,
        parent,
        topic: saved.topic || undefined,
        nsfw: saved.nsfw || false,
        bitrate: saved.bitrate || undefined,
        userLimit: saved.userLimit || undefined,
        permissionOverwrites: overwrites,
        reason: 'API restore',
      });
      restoredChannels++;
    }
    channelMap.set(saved.oldId, channel.id);
  }

  return { restoredRoles, restoredChannels };
}

module.exports = { saveSnapshot, restoreSnapshot };
