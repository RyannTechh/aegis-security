const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');

const { isOwner } = require('../../utils/checks');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verifypanel')
    .setDescription('Post the SALRP FiveM verification panel.'),

  async execute(interaction, client) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        embeds: [errorEmbed('Owner only', 'Only a configured bot owner can use this command.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channelId = String(process.env.FIVEM_VERIFY_CHANNEL_ID || '').trim();
    const roleId = String(process.env.FIVEM_VERIFY_ROLE_ID || '').trim();
    const joinCode = String(process.env.FIVEM_JOIN_CODE || '').trim();

    if (!channelId || !roleId || !joinCode) {
      return interaction.editReply({
        embeds: [errorEmbed(
          'Verification not configured',
          'Set FIVEM_VERIFY_CHANNEL_ID, FIVEM_VERIFY_ROLE_ID and FIVEM_JOIN_CODE in .env.'
        )],
      });
    }

    const channel =
      client.channels.cache.get(channelId)
      || await client.channels.fetch(channelId).catch(() => null);

    if (!channel?.isTextBased() || channel.guildId !== interaction.guildId) {
      return interaction.editReply({
        embeds: [errorEmbed('Verification channel unavailable', 'Check FIVEM_VERIFY_CHANNEL_ID.')],
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle('Welcome to San Andreas Life Roleplay')
      .setDescription('If you have not connected to our server before, you may need to verify your account.')
      .addFields(
        {
          name: 'Connection Instructions',
          value: `Press **F8** and type:\n\`\`\`connect cfx.re/join/${joinCode}\`\`\``,
        },
        {
          name: 'Verification',
          value:
            'Fully join the FiveM server, then press **Get Verified**.\n\n'
            + 'Your Discord account must be connected to FiveM. '
            + 'If FiveM does not provide your Discord identifier, verification will fail.',
        }
      )
      .setFooter({
        text: 'San Andreas Life Roleplay • Verification System',
        iconURL: interaction.guild.iconURL({ extension: 'png', size: 128 }) || undefined,
      });

    if (interaction.guild.iconURL()) {
      embed.setThumbnail(interaction.guild.iconURL({ extension: 'png', size: 256 }));
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Connect (Click Here to Connect)')
        .setEmoji('🔗')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://cfx.re/join/${joinCode}`),
      new ButtonBuilder()
        .setCustomId('fivemverify:getverified')
        .setLabel('Get Verified')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success)
    );

    await channel.send({ embeds: [embed], components: [row] });

    return interaction.editReply({
      embeds: [successEmbed('Verification panel posted', `Posted in ${channel}.`)],
    });
  },
};
