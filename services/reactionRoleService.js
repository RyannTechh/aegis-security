const db = require('../database/database');

db.exec(`
  CREATE TABLE IF NOT EXISTS reaction_roles (
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    emoji_key TEXT NOT NULL,
    emoji_display TEXT NOT NULL,
    role_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, message_id, emoji_key)
  );
`);

function getEmojiKey(emoji) {
  if (!emoji) return null;

  if (typeof emoji === 'string') {
    const customMatch = emoji.match(/^<a?:([A-Za-z0-9_]+):(\d{17,20})>$/);

    if (customMatch) {
      return customMatch[2];
    }

    return emoji;
  }

  return emoji.id || emoji.name || null;
}

function getEmojiDisplay(emoji) {
  if (!emoji) return 'Unknown emoji';

  if (typeof emoji === 'string') {
    return emoji;
  }

  if (emoji.id) {
    return `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`;
  }

  return emoji.name || 'Unknown emoji';
}

function saveReactionRole({
  guildId,
  channelId,
  messageId,
  emojiKey,
  emojiDisplay,
  roleId,
  createdBy,
}) {
  db.prepare(`
    INSERT OR REPLACE INTO reaction_roles (
      guild_id,
      channel_id,
      message_id,
      emoji_key,
      emoji_display,
      role_id,
      created_by,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    guildId,
    channelId,
    messageId,
    emojiKey,
    emojiDisplay,
    roleId,
    createdBy,
    Date.now()
  );
}

function removeReactionRole(guildId, messageId, emojiKey) {
  return db.prepare(`
    DELETE FROM reaction_roles
    WHERE guild_id = ?
      AND message_id = ?
      AND emoji_key = ?
  `).run(
    guildId,
    messageId,
    emojiKey
  ).changes;
}

function getReactionRole(guildId, messageId, emojiKey) {
  return db.prepare(`
    SELECT *
    FROM reaction_roles
    WHERE guild_id = ?
      AND message_id = ?
      AND emoji_key = ?
  `).get(
    guildId,
    messageId,
    emojiKey
  );
}

function listReactionRoles(guildId) {
  return db.prepare(`
    SELECT *
    FROM reaction_roles
    WHERE guild_id = ?
    ORDER BY created_at ASC
  `).all(guildId);
}

function removeReactionRolesForMessage(guildId, messageId) {
  return db.prepare(`
    DELETE FROM reaction_roles
    WHERE guild_id = ?
      AND message_id = ?
  `).run(
    guildId,
    messageId
  ).changes;
}

module.exports = {
  getEmojiKey,
  getEmojiDisplay,
  saveReactionRole,
  removeReactionRole,
  getReactionRole,
  listReactionRoles,
  removeReactionRolesForMessage,
};
