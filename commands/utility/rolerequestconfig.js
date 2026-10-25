const {
  SlashCommandBuilder,
  MessageFlags,
} = require('discord.js');

const {
  isOwner,
} = require('../../utils/checks');

const {
  addApprovalRole,
  removeApprovalRole,
  listApprovalMappings,
} = require('../../services/roleRequestService');

const {
  successEmbed,
  errorEmbed,
  infoEmbed,
} = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rolerequestconfig')
    .setDescription('Configure which roles can approve requested roles.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('Allow a role to approve another role')
        .addRoleOption((option) =>
          option
            .setName('requested_role')
            .setDescription('Role users will request')
            .setRequired(true)
        )
        .addRoleOption((option) =>
          option
            .setName('approver_role')
            .setDescription('Role allowed to approve the requested role')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('Remove an approval-role association')
        .addRoleOption((option) =>
          option
            .setName('requested_role')
            .setDescription('Requested role')
            .setRequired(true)
        )
        .addRoleOption((option) =>
          option
            .setName('approver_role')
            .setDescription('Approver role to remove')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('Show all configured role approval mappings')
    ),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Owner only',
            'Only a configured bot owner can change role request approval settings.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'list') {
      const rows = listApprovalMappings(interaction.guild.id);

      if (!rows.length) {
        return interaction.reply({
          embeds: [
            infoEmbed(
              'Role Request Approval Configuration',
              'No approval mappings are configured.'
            ),
          ],
          flags: MessageFlags.Ephemeral,
        });
      }

      const grouped = new Map();

      for (const row of rows) {
        if (!grouped.has(row.requested_role_id)) {
          grouped.set(row.requested_role_id, []);
        }

        grouped.get(row.requested_role_id).push(
          row.approver_role_id
        );
      }

      const description = [...grouped.entries()]
        .map(([requestedRoleId, approverRoleIds]) =>
          `<@&${requestedRoleId}>\n`
          + `Can be approved by: ${approverRoleIds
              .map((roleId) => `<@&${roleId}>`)
              .join(', ')}`
        )
        .join('\n\n');

      return interaction.reply({
        embeds: [
          infoEmbed(
            'Role Request Approval Configuration',
            description
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const requestedRole = interaction.options.getRole(
      'requested_role',
      true
    );

    const approverRole = interaction.options.getRole(
      'approver_role',
      true
    );

    if (
      requestedRole.id === interaction.guild.id
      || approverRole.id === interaction.guild.id
    ) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Invalid role',
            'The @everyone role cannot be used in role request approval configuration.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (subcommand === 'add') {
      addApprovalRole(
        interaction.guild.id,
        requestedRole.id,
        approverRole.id,
        interaction.user.id
      );

      return interaction.reply({
        embeds: [
          successEmbed(
            'Approval role configured',
            `${approverRole} can now approve requests for ${requestedRole}.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const removed = removeApprovalRole(
      interaction.guild.id,
      requestedRole.id,
      approverRole.id
    );

    return interaction.reply({
      embeds: [
        successEmbed(
          'Approval role removed',
          removed
            ? `${approverRole} can no longer approve requests for ${requestedRole}.`
            : 'That approval association was not configured.'
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
