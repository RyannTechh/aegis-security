const { brandEmbed, brandFiles } = require('../utils/branding');
const {
  EmbedBuilder,
} = require('discord.js');

const db = require('../database/database');

db.exec(`
  CREATE TABLE IF NOT EXISTS welcome_settings (
    guild_id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    welcome_type TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

const WELCOME_MESSAGES = Object.freeze({
  main: {
    title: '🌴 Welcome to San Andreas Life Roleplay! 🌴',
    color: 0xFF69B4,
    description: [
      'Welcome to San Andreas Life Roleplay, where every decision shapes your story.',
      '',
      "Whether you're protecting the city as law enforcement, saving lives as EMS, fighting fires, building a criminal empire, or running a successful business, there's a place for you here.",
      '',
      'Before you begin, please remember to:',
      '',
      '📖 Read and follow all server rules.',
      '🤝 Treat everyone with respect.',
      '🎭 Prioritize realistic and immersive roleplay.',
      '🚫 No random deathmatching, metagaming, or exploiting.',
      '💬 If you need help, our staff team is always available.',
      '',
      'We hope you enjoy your time in San Andreas Life Roleplay. Create unforgettable stories, make new friends, and have fun!',
      '',
      '🌴 Welcome to San Andreas Life Roleplay—your story starts now.',
    ].join('\n'),
  },

  staff: {
    title: '🛡️ Welcome to the San Andreas Life Roleplay Staff Team! 🛡️',
    color: 0xED4245,
    description: [
      'Congratulations on joining the staff team.',
      '',
      "As a staff member, you're responsible for helping maintain a fair, enjoyable, and professional environment for everyone.",
      '',
      'Please remember to:',
      '',
      '📖 Follow all staff guidelines and server policies.',
      '🤝 Remain respectful and unbiased.',
      '⚖️ Handle reports fairly and professionally.',
      '💬 Communicate clearly with players and fellow staff.',
      '🌟 Represent San Andreas Life Roleplay with integrity.',
      '',
      'Thank you for helping our community grow and thrive.',
      '',
      '🛡️ Lead by example and make a difference.',
    ].join('\n'),
  },

  gangs: {
    title: '🔥 Welcome to the San Andreas Life Roleplay Gangs Community! 🔥',
    color: 0x9B59B6,
    description: [
      'The streets are yours to conquer.',
      '',
      "Whether you're building a new crew, leading an established gang, or making your name known across Miami, every decision matters.",
      '',
      'As a gang member, please remember to:',
      '',
      '📖 Follow all gang and server rules.',
      '🤝 Respect roleplay and other players.',
      '🎭 Keep gang roleplay realistic and enjoyable.',
      '🚫 No random violence, exploiting, or breaking character.',
      '⚔️ Create memorable rivalries, alliances, and stories.',
      '',
      "Build your reputation, defend your territory, and become one of Miami's most feared organizations.",
      '',
      '🔥 The streets are waiting.',
    ].join('\n'),
  },

  departments: {
    title: '🚔 Welcome to the San Andreas Life Roleplay Departments! 🚔',
    color: 0x57F287,
    description: [
      'Thank you for joining one of our official departments.',
      '',
      'Whether you serve in Law Enforcement, Fire Rescue, EMS, Communications, or another agency, your professionalism helps create the best roleplay possible.',
      '',
      'Please remember to:',
      '',
      '📖 Read all department SOPs and server rules.',
      '🤝 Treat civilians and fellow members with professionalism.',
      '🎭 Maintain realistic roleplay at all times.',
      '📋 Follow your chain of command.',
      '💬 Ask leadership if you have any questions.',
      '',
      'Your dedication helps keep Miami running.',
      '',
      '🚔 Serve with pride. Lead by example.',
    ].join('\n'),
  },
});

function setWelcomeSettings(guildId, channelId, welcomeType, updatedBy) {
  db.prepare(`
    INSERT OR REPLACE INTO welcome_settings
    (guild_id, channel_id, welcome_type, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    guildId,
    channelId,
    welcomeType,
    updatedBy,
    Date.now()
  );
}

function getWelcomeSettings(guildId) {
  return db.prepare(`
    SELECT guild_id, channel_id, welcome_type, updated_by, updated_at
    FROM welcome_settings
    WHERE guild_id = ?
  `).get(guildId);
}

function buildWelcomeEmbed(guild, welcomeType) {
  const welcome = WELCOME_MESSAGES[welcomeType];

  if (!welcome) {
    throw new Error(`Unknown welcome type: ${welcomeType}`);
  }

  const embed = new EmbedBuilder()
    .setColor(welcome.color)
    .setTitle(welcome.title)
    .setDescription(welcome.description)
    .setThumbnail('attachment://miami-roleplay-logo.png')
    .setFooter({
      text: 'San Andreas Life Roleplay',
    })
    .setTimestamp();

  return embed;
}

async function sendWelcomeMessage(member) {
  if (member.user.bot) {
    return {
      sent: false,
      reason: 'Bot account',
    };
  }

  const settings = getWelcomeSettings(member.guild.id);

  if (!settings) {
    return {
      sent: false,
      reason: 'Welcome system not configured',
    };
  }

  const channel =
    member.guild.channels.cache.get(settings.channel_id)
    || await member.guild.channels.fetch(settings.channel_id).catch(() => null);

  if (!channel?.isTextBased()) {
    return {
      sent: false,
      reason: 'Configured welcome channel is unavailable',
    };
  }

  const embed = buildWelcomeEmbed(
    member.guild,
    settings.welcome_type
  );

  await channel.send({
    content: `${member}`,
    embeds: [brandEmbed(embed)],
    files: brandFiles(),
    allowedMentions: {
      users: [member.id],
    },
  });

  return {
    sent: true,
    channelId: channel.id,
    welcomeType: settings.welcome_type,
  };
}

module.exports = {
  WELCOME_MESSAGES,
  setWelcomeSettings,
  getWelcomeSettings,
  buildWelcomeEmbed,
  sendWelcomeMessage,
};
