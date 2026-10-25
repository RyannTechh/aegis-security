const {
  SlashCommandBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  MessageFlags,
} = require('discord.js');

const { isOwner } = require('../../utils/checks');
const {
  brandEmbed,
  brandFiles,
} = require('../../utils/branding');
const { errorEmbed, successEmbed } = require('../../utils/embeds');
const {
  TICKET_TYPES,
  NORMAL_TICKET_KEYS,
  CENSORED_TICKET_KEYS,
} = require('../../services/ticketService');

function makeSelect(customId, keys) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('Select a ticket category...')
    .setMinValues(1)
    .setMaxValues(1);

  for (const key of keys) {
    const type = TICKET_TYPES[key];
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(type.label)
        .setValue(type.key)
        .setDescription(type.description.slice(0, 100))
        .setEmoji(type.emoji)
    );
  }

  return new ActionRowBuilder().addComponents(menu);
}

function makeNormalPanel() {
  const lines = NORMAL_TICKET_KEYS.map((key) => {
    const type = TICKET_TYPES[key];
    return `• **${type.label}:** ${type.description}`;
  });

  return brandEmbed(
    new EmbedBuilder()
      .setColor(0x19D3FF)
      .setTitle('Ticket Panel')
      .setDescription(
        'If you need any assistance, please select a ticket category.\n\n'
        + lines.join('\n')
      )
  );
}

function makeCensoredPanel() {
  const type = TICKET_TYPES.censored;

  return brandEmbed(
    new EmbedBuilder()
      .setColor(0x19D3FF)
      .setTitle('Censored Tickets')
      .setDescription(
        'If you need any assistance, please select a ticket category.\n\n'
        + `• **${type.label}:** ${type.description}`
      )
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('Send one of the SALRP ticket panels. Owner only.')
    .addStringOption((option) =>
      option
        .setName('panel')
        .setDescription('Which ticket panel to send')
        .setRequired(true)
        .addChoices(
          { name: 'Normal Tickets', value: 'normal' },
          { name: 'Censored Tickets', value: 'censored' }
        )
    ),

  async execute(interaction, client) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Owner only',
            'Only a configured bot owner can send ticket panels.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const panel = interaction.options.getString('panel', true);
    const channelEnv = panel === 'normal'
      ? 'TICKET_NORMAL_PANEL_CHANNEL_ID'
      : 'TICKET_CENSORED_PANEL_CHANNEL_ID';

    const channelId = String(process.env[channelEnv] || '').trim();

    if (!channelId) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Panel channel not configured',
            `Add ${channelEnv}=CHANNEL_ID to your .env file.`
          ),
        ],
      });
    }

    const channel =
      client.channels.cache.get(channelId)
      || await client.channels.fetch(channelId).catch(() => null);

    if (!channel?.isTextBased() || channel.guildId !== interaction.guildId) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Invalid panel channel',
            `${channelEnv} does not point to a text channel in this server.`
          ),
        ],
      });
    }

    const embed = panel === 'normal'
      ? makeNormalPanel()
      : makeCensoredPanel();

    const row = panel === 'normal'
      ? makeSelect('ticket:panel:normal', NORMAL_TICKET_KEYS)
      : makeSelect('ticket:panel:censored', CENSORED_TICKET_KEYS);

    await channel.send({
      embeds: [embed],
      components: [row],
      files: brandFiles(),
    });

    return interaction.editReply({
      embeds: [
        successEmbed(
          'Ticket panel sent',
          `The **${panel === 'normal' ? 'Normal' : 'Censored'}** ticket panel was sent to ${channel}.`
        ),
      ],
    });
  },
};
