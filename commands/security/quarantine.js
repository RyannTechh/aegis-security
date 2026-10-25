const {
  SlashCommandBuilder,
  MessageFlags,
} = require('discord.js');

const { isOwner } = require('../../utils/checks');
const {
  quarantineMember,
} = require('../../services/quarantineService');

const {
  successEmbed,
  errorEmbed,
} = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quarantine')
    .setDescription('Save a member’s roles, strip them, and give the quarantine role.')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Member to quarantine')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Reason for quarantine')
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
      || `Quarantined by ${interaction.user.tag}`;

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

    if (member.id === interaction.guild.ownerId) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Cannot quarantine server owner',
            'The server owner cannot be quarantined.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({
      flags: MessageFlags.Ephemeral,
    });

    try {
      const result = await quarantineMember(
        member,
        interaction.user.id,
        reason
      );

      return interaction.editReply({
        embeds: [
          successEmbed(
            'Member quarantined',
            `${member} was quarantined.\n\n`
            + `Roles removed: **${result.removed}**\n`
            + `Quarantine role: <@&${result.quarantineRoleId}>\n`
            + `Previous backup reused: **${result.alreadyQuarantined ? 'Yes' : 'No'}**`
          ),
        ],
      });
    } catch (error) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Quarantine failed',
            error?.message || 'Unknown error'
          ),
        ],
      });
    }
  },
};
