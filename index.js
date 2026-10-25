require('dotenv').config();

const {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
} = require('discord.js');

const {
  loadCommands,
} = require('./handlers/commandHandler');

const {
  loadEvents,
} = require('./handlers/eventHandler');

require('./database/database');

if (!process.env.TOKEN) {
  throw new Error('TOKEN is missing from .env');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,

    // Required for detecting and deleting Discord invite links.
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],

  partials: [
    Partials.GuildMember,
    Partials.User,
    Partials.Message,
    Partials.Channel,
  ],
});

client.commands = new Collection();

// San Andreas Life Roleplay embed branding: automatically adds the Miami logo to every
// embed sent by the bot, including existing command/log embeds.
const { brandEmbed, brandFiles } = require('./utils/branding');

function applyMiamiBranding(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.embeds) || payload.embeds.length === 0) {
    return payload;
  }

  const embeds = payload.embeds.map((embed) => {
    if (embed && typeof embed.setThumbnail === 'function') {
      return brandEmbed(embed);
    }
    return embed;
  });

  return {
    ...payload,
    embeds,
    files: [...(payload.files || []), ...brandFiles()],
  };
}

client.on('debug', () => {});
client.miamiBrandPayload = applyMiamiBranding;

loadCommands(client);
loadEvents(client);

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

client.login(process.env.TOKEN);
