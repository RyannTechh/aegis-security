const {
  SlashCommandBuilder,
  MessageFlags,
} = require('discord.js');

const {
  restoreMemberRoles,
} = require('../../services/memberRoleBackupService');

const {
  successEmbed,
  errorEmbed,
} = require('../../utils/embeds');

const API_COMMAND_ROLE_ID = '1533606260279214301';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('api')
    .setDescription(
      'Restore a member’s saved roles after they rejoin the server.'
    )
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Member whose saved roles should be restored')
        .setRequired(true)
    ),

  async execute(interaction) {
    const hasRequiredRole = interaction.member.roles.cache.has(
      API_COMMAND_ROLE_ID
    );

    if (!hasRequiredRole) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'No permission',
            `You need the <@&${API_COMMAND_ROLE_ID}> role to use this command.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const selectedUser = interaction.options.getUser(
      'user',
      true
    );

    const member = await interaction.guild.members
      .fetch(selectedUser.id)
      .catch(() => null);

    if (!member) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Member not found',
            'That user must be inside this server before their roles can be restored.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({
      flags: MessageFlags.Ephemeral,
    });

    const result = await restoreMemberRoles(member);

    if (!result.found) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'No saved roles',
            `No saved role backup exists for ${member}.`
          ),
        ],
      });
    }

    const restoredText = result.restored.length
      ? result.restored
          .map((item) => `<@&${item.roleId}>`)
          .join(', ')
      : 'None';

    const skippedPreview = result.skipped
      .slice(0, 10)
      .map((item) =>
        `• ${item.roleName || item.roleId} — ${item.reason}`
      )
      .join('\n');

    const failedPreview = result.failed
      .slice(0, 10)
      .map((item) =>
        `• ${item.roleName || item.roleId} — ${item.reason}`
      )
      .join('\n');

    let description =
      `Member: ${member}\n`
      + `Backup saved: <t:${Math.floor(result.savedAt / 1000)}:F>\n`
      + `Restored: **${result.restored.length}**\n`
      + `Skipped: **${result.skipped.length}**\n`
      + `Failed: **${result.failed.length}**\n\n`
      + `**Restored Roles**\n${restoredText}`;

    if (skippedPreview) {
      description += `\n\n**Skipped Roles**\n${skippedPreview}`;
    }

    if (failedPreview) {
      description += `\n\n**Failed Roles**\n${failedPreview}`;
    }

    return interaction.editReply({
      embeds: [
        successEmbed(
          'Saved roles restored',
          description
        ),
      ],
    });
  },
};
