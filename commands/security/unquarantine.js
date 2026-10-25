const {
  SlashCommandBuilder,
  MessageFlags,
} = require('discord.js');

const { isOwner } = require('../../utils/checks');
const {
  unquarantineMember,
} = require('../../services/quarantineService');

const {
  successEmbed,
  errorEmbed,
} = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unquarantine')
    .setDescription('Remove quarantine and restore a member’s saved roles.')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Member to unquarantine')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Reason for unquarantine')
        .setRequired(false)
        .setMaxLength(500)
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

    const user = interaction.options.getUser('user', true);
    const reason =
      interaction.options.getString('reason')
      || `Unquarantined by ${interaction.user.tag}`;

    const member = await interaction.guild.members
      .fetch(user.id)
      .catch(() => null);

    if (!member) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Member not found',
            'That user is not currently in this server.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({
      flags: MessageFlags.Ephemeral,
    });

    try {
      const result = await unquarantineMember(
        member,
        interaction.user.id,
        reason
      );

      return interaction.editReply({
        embeds: [
          successEmbed(
            'Member unquarantined',
            `${member} was unquarantined.\n\n`
            + `Roles restored: **${result.restored}**\n`
            + `Skipped: **${result.skipped.length}**`
          ),
        ],
      });
    } catch (error) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Unquarantine failed',
            error?.message || 'Unknown error'
          ),
        ],
      });
    }
  },
};
