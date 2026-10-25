const {
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');

const db = require('../database/database');
const { parseIds, isOwner } = require('../utils/checks');

const TICKET_TYPES = Object.freeze({
  general: {
    key: 'general',
    label: 'General Support',
    emoji: '🎫',
    description: 'For inquiries related to general assistance or information.',
    categoryEnv: 'TICKET_GENERAL_CATEGORY_ID',
  },
  management_report: {
    key: 'management_report',
    label: 'Management Report',
    emoji: '📋',
    description: 'Use this to report concerns or issues with management members.',
    categoryEnv: 'TICKET_MANAGEMENT_REPORT_CATEGORY_ID',
  },
  staff_report: {
    key: 'staff_report',
    label: 'Staff Report',
    emoji: '🛡️',
    description: 'Use this to report concerns or issues with staff members.',
    categoryEnv: 'TICKET_STAFF_REPORT_CATEGORY_ID',
  },
  management: {
    key: 'management',
    label: 'Management Ticket',
    emoji: '👔',
    description: 'For escalated issues or feedback that require the attention of management.',
    categoryEnv: 'TICKET_MANAGEMENT_CATEGORY_ID',
  },
  iaa: {
    key: 'iaa',
    label: 'IAA Ticket',
    emoji: '🕵️',
    description: 'For people looking to merge their server or transfer into San Andreas Life Roleplay.',
    categoryEnv: 'TICKET_IAA_CATEGORY_ID',
  },
  ban_appeal: {
    key: 'ban_appeal',
    label: 'Ban Appeals Ticket',
    emoji: '🔨',
    description: 'For questions or assistance related to an in-game ban.',
    categoryEnv: 'TICKET_BAN_APPEAL_CATEGORY_ID',
  },
  department_report: {
    key: 'department_report',
    label: 'Department Report Ticket',
    emoji: '🚔',
    description: 'Use this to report concerns or issues with department members.',
    categoryEnv: 'TICKET_DEPARTMENT_REPORT_CATEGORY_ID',
  },
  store_support: {
    key: 'store_support',
    label: 'Store Support Ticket',
    emoji: '🛒',
    description: 'For questions or assistance related to purchases, orders, or transactions in our store.',
    categoryEnv: 'TICKET_STORE_SUPPORT_CATEGORY_ID',
  },
  censored: {
    key: 'censored',
    label: 'Censored Ticket',
    emoji: '🔒',
    description: 'Make a Censored ticket for any questions or if you would like to transfer/merge.',
    categoryEnv: 'TICKET_CENSORED_CATEGORY_ID',
  },
});

const NORMAL_TICKET_KEYS = [
  'general',
  'management_report',
  'staff_report',
  'management',
  'iaa',
  'ban_appeal',
  'department_report',
  'store_support',
];

const CENSORED_TICKET_KEYS = ['censored'];

db.exec(`
  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT,
    opener_id TEXT NOT NULL,
    ticket_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    claimed_by TEXT,
    question TEXT,
    support_details TEXT,
    created_at INTEGER NOT NULL,
    closed_at INTEGER,
    closed_by TEXT
  );
`);

function getTicketType(key) {
  return TICKET_TYPES[key] || null;
}

function getCategoryId(typeKey) {
  const type = getTicketType(typeKey);
  if (!type) return null;
  return String(process.env[type.categoryEnv] || '').trim() || null;
}

function canManageTicket(member, channel = null) {
  if (!member) return false;
  if (isOwner(member.id)) return true;

  const permissions = channel
    ? channel.permissionsFor(member)
    : member.permissions;

  return Boolean(
    permissions?.has(PermissionFlagsBits.ManageChannels)
    || permissions?.has(PermissionFlagsBits.ManageMessages)
  );
}

function getTicketByChannel(channelId) {
  return db.prepare(`
    SELECT * FROM tickets
    WHERE channel_id = ? AND status = 'open'
    LIMIT 1
  `).get(channelId);
}

function getOpenTicketForUser(guildId, openerId) {
  return db.prepare(`
    SELECT * FROM tickets
    WHERE guild_id = ? AND opener_id = ? AND status = 'open'
    ORDER BY id DESC
    LIMIT 1
  `).get(guildId, openerId);
}

function createTicketRecord({
  guildId,
  openerId,
  ticketType,
  question,
  supportDetails,
}) {
  const result = db.prepare(`
    INSERT INTO tickets (
      guild_id,
      opener_id,
      ticket_type,
      status,
      question,
      support_details,
      created_at
    )
    VALUES (?, ?, ?, 'open', ?, ?, ?)
  `).run(
    guildId,
    openerId,
    ticketType,
    question,
    supportDetails,
    Date.now()
  );

  return Number(result.lastInsertRowid);
}

function attachTicketChannel(ticketId, channelId) {
  db.prepare(`
    UPDATE tickets
    SET channel_id = ?
    WHERE id = ?
  `).run(channelId, ticketId);
}

function setClaimedBy(channelId, userId) {
  const existing = db.prepare(`
    SELECT claimed_by
    FROM tickets
    WHERE channel_id = ? AND status = 'open'
    LIMIT 1
  `).get(channelId);

  if (!existing) {
    return {
      success: false,
      claimedBy: null,
      reason: 'ticket_not_found',
    };
  }

  if (existing.claimed_by) {
    return {
      success: false,
      claimedBy: existing.claimed_by,
      reason: 'already_claimed',
    };
  }

  const result = db.prepare(`
    UPDATE tickets
    SET claimed_by = ?
    WHERE channel_id = ?
      AND status = 'open'
      AND (claimed_by IS NULL OR claimed_by = '')
  `).run(userId, channelId);

  if (result.changes === 0) {
    const current = db.prepare(`
      SELECT claimed_by
      FROM tickets
      WHERE channel_id = ?
      LIMIT 1
    `).get(channelId);

    return {
      success: false,
      claimedBy: current?.claimed_by || null,
      reason: 'already_claimed',
    };
  }

  return {
    success: true,
    claimedBy: userId,
    reason: null,
  };
}

function changeTicketType(channelId, typeKey) {
  db.prepare(`
    UPDATE tickets
    SET ticket_type = ?
    WHERE channel_id = ? AND status = 'open'
  `).run(typeKey, channelId);
}

function closeTicket(channelId, userId) {
  db.prepare(`
    UPDATE tickets
    SET status = 'closed', closed_at = ?, closed_by = ?
    WHERE channel_id = ? AND status = 'open'
  `).run(Date.now(), userId, channelId);
}

function sanitizeChannelPart(value) {
  return String(value || 'ticket')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'ticket';
}

function makeTicketChannelName(type, userId) {
  return `${sanitizeChannelPart(type.label)}-${userId}`.slice(0, 100);
}

async function createTicketChannel({
  guild,
  opener,
  typeKey,
  question,
  supportDetails,
}) {
  const type = getTicketType(typeKey);
  if (!type) throw new Error('Unknown ticket type.');

  const categoryId = getCategoryId(typeKey);
  if (!categoryId) {
    throw new Error(`${type.categoryEnv} is not configured in .env.`);
  }

  const category =
    guild.channels.cache.get(categoryId)
    || await guild.channels.fetch(categoryId).catch(() => null);

  if (!category || category.type !== ChannelType.GuildCategory) {
    throw new Error(`${type.categoryEnv} does not point to a valid category.`);
  }

  const current = getOpenTicketForUser(guild.id, opener.id);
  if (current) {
    const currentChannel = guild.channels.cache.get(current.channel_id);
    if (currentChannel) {
      return { duplicate: true, ticket: current, channel: currentChannel };
    }

    closeTicket(current.channel_id, guild.client.user.id);
  }

  const ticketId = createTicketRecord({
    guildId: guild.id,
    openerId: opener.id,
    ticketType: typeKey,
    question,
    supportDetails,
  });

  /*
   * Copy the configured Discord category permissions.
   * This means you control which staff/management roles can see and manage
   * tickets directly through the category permissions in Discord.
   * No TICKET_STAFF_ROLE_IDS setting is needed.
   */
  const overwrites = category.permissionOverwrites.cache.map((overwrite) => ({
    id: overwrite.id,
    type: overwrite.type,
    allow: overwrite.allow.bitfield,
    deny: overwrite.deny.bitfield,
  }));

  /*
   * Always grant the ticket opener access to their own ticket.
   */
  overwrites.push({
    id: opener.id,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.EmbedLinks,
    ],
  });

  const channel = await guild.channels.create({
    name: makeTicketChannelName(type, opener.id),
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `SALRP Ticket #${ticketId} | ${type.label} | User ${opener.id}`,
    permissionOverwrites: overwrites,
    reason: `SALRP ticket #${ticketId} opened by ${opener.user.tag}`,
  });

  attachTicketChannel(ticketId, channel.id);

  return {
    duplicate: false,
    ticket: {
      id: ticketId,
      guild_id: guild.id,
      channel_id: channel.id,
      opener_id: opener.id,
      ticket_type: typeKey,
      question,
      support_details: supportDetails,
    },
    channel,
  };
}

module.exports = {
  TICKET_TYPES,
  NORMAL_TICKET_KEYS,
  CENSORED_TICKET_KEYS,
  getTicketType,
  getCategoryId,
  canManageTicket,
  getTicketByChannel,
  getOpenTicketForUser,
  createTicketRecord,
  attachTicketChannel,
  setClaimedBy,
  changeTicketType,
  closeTicket,
  makeTicketChannelName,
  createTicketChannel,
};
