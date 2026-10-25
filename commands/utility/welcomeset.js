const { brandFiles } = require('../../utils/branding');
const {
  SlashCommandBuilder,
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');

const {
  isOwner,
} = require('../../utils/checks');

const {
  setWelcomeSettings,
  buildWelcomeEmbed,
} = require('../../services/welcomeService');

const {
  successEmbed,
  errorEmbed,
} = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcomeset')
    .setDescription('Configure the automatic welcome message for this server.')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Channel where joining members will be welcomed')
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement
        )
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Welcome message used by this server')
        .setRequired(true)
        .addChoices(
          {
            name: 'Main',
            value: 'main',
          },
          {
            name: 'Staff',
            value: 'staff',
          },
          {
            name: 'Gangs',
            value: 'gangs',
          },
          {
            name: 'Departments',
            value: 'departments',
          }
        )
    ),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Owner only',
            'Only a configured bot owner can use this command.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const channel = interaction.options.getChannel(
      'channel',
      true
    );

    const welcomeType = interaction.options.getString(
      'type',
      true
    );

    const botMember = interaction.guild.members.me;

    const permissions = channel.permissionsFor(botMember);

    if (
      !permissions?.has(PermissionFlagsBits.ViewChannel)
      || !permissions?.has(PermissionFlagsBits.SendMessages)
      || !permissions?.has(PermissionFlagsBits.EmbedLinks)
    ) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Missing channel permissions',
            `I need **View Channel**, **Send Messages**, and **Embed Links** in ${channel}.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    setWelcomeSettings(
      interaction.guild.id,
      channel.id,
      welcomeType,
      interaction.user.id
    );

    const previewEmbed = buildWelcomeEmbed(
      interaction.guild,
      welcomeType
    );

    await interaction.reply({
      embeds: [
        successEmbed(
          'Automatic welcome configured',
          `New members in **${interaction.guild.name}** will now receive the **${welcomeType}** welcome message in ${channel}.`
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });

    await channel.send({
      content: '**Welcome message preview:**',
      embeds: [previewEmbed],
      files: brandFiles(),
      allowedMentions: {
        parse: [],
      },
    });
  },
};
