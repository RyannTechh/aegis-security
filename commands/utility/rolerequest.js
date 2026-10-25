const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');

const {
  createRoleRequest,
  attachMessage,
  memberCanApproveRole,
  getApprovalRoles,
} = require('../../services/roleRequestService');

const {
  errorEmbed,
  successEmbed,
} = require('../../utils/embeds');

const ROLE_REQUEST_CHANNEL_ID = '1533606757258104912';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rolerequest')
    .setDescription('Request a role assignment approval.')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('User who should receive the role')
        .setRequired(true)
    )
    .addRoleOption((option) =>
      option
        .setName('role')
        .setDescription('Role being requested')
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName('approver')
        .setDescription('User who must approve or deny this request')
        .setRequired(true)
    ),

  async execute(interaction, client) {
    await interaction.deferReply({
      flags: MessageFlags.Ephemeral,
    });

    const targetUser = interaction.options.getUser('user', true);
    const role = interaction.options.getRole('role', true);
    const approverUser = interaction.options.getUser('approver', true);
    const guild = interaction.guild;

    if (role.id === guild.id) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Invalid role',
            'The @everyone role cannot be requested.'
          ),
        ],
      });
    }

    if (role.managed) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Invalid role',
            'Integration-managed roles cannot be requested.'
          ),
        ],
      });
    }

    const targetMember = await guild.members
      .fetch(targetUser.id)
      .catch(() => null);

    const approverMember = await guild.members
      .fetch(approverUser.id)
      .catch(() => null);

    if (!targetMember) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Target not found',
            'The selected target user is not in this server.'
          ),
        ],
      });
    }

    if (!approverMember) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Approver not found',
            'The selected approver is not in this server.'
          ),
        ],
      });
    }

    if (approverUser.bot) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Invalid approver',
            'A bot cannot be selected as the approver.'
          ),
        ],
      });
    }

    if (targetMember.roles.cache.has(role.id)) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Role already assigned',
            `${targetUser} already has ${role}.`
          ),
        ],
      });
    }

    const configuredApprovalRoles = getApprovalRoles(
      guild.id,
      role.id
    );

    if (!configuredApprovalRoles.length) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'No approval roles configured',
            `No approver roles are configured for ${role}.\n`
            + 'Use `/rolerequestconfig add` first.'
          ),
        ],
      });
    }

    if (!memberCanApproveRole(approverMember, role.id)) {
      const allowedMentions = configuredApprovalRoles
        .map((row) => `<@&${row.approver_role_id}>`)
        .join(', ');

      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Approver not authorized',
            `${approverUser} does not have a role allowed to approve ${role}.\n\n`
            + `Allowed approver roles: ${allowedMentions}`
          ),
        ],
      });
    }

    /*
     * No hierarchy check for the APPROVER.
     * The bot itself still has to be able to manage the requested role,
     * because Discord will reject the actual role assignment otherwise.
     */
    if (!role.editable) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Bot cannot manage role',
            'Move the bot role above the requested role so the bot can assign it.'
          ),
        ],
      });
    }

    const requestChannel =
      client.channels.cache.get(ROLE_REQUEST_CHANNEL_ID)
      || await client.channels.fetch(ROLE_REQUEST_CHANNEL_ID).catch(() => null);

    if (
      !requestChannel
      || !requestChannel.isTextBased()
      || requestChannel.guildId !== guild.id
    ) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Role request channel unavailable',
            `The configured role request channel <#${ROLE_REQUEST_CHANNEL_ID}> is unavailable in this server.`
          ),
        ],
      });
    }

    const requestId = createRoleRequest({
      guildId: guild.id,
      requesterId: interaction.user.id,
      approverId: approverUser.id,
      targetUserId: targetUser.id,
      roleId: role.id,
      channelId: requestChannel.id,
    });

    const embed = new EmbedBuilder()
      .setColor(0xC026D3)
      .setTitle('Role Request')
      .addFields(
        {
          name: 'Requester',
          value: `${interaction.user}\n\`${interaction.user.id}\``,
          inline: false,
        },
        {
          name: 'Approved By',
          value: `${approverUser}\n\`${approverUser.id}\``,
          inline: false,
        },
        {
          name: 'Target User',
          value: `${targetUser}\n\`${targetUser.id}\``,
          inline: false,
        },
        {
          name: 'Role',
          value: `${role}\n${role.name} | \`${role.id}\``,
          inline: false,
        }
      )
      .setFooter({
        text: `Role Request #${requestId}`,
        iconURL:
          guild.iconURL({
            size: 128,
            extension: 'png',
          }) || undefined,
      })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`rolerequest:approve:${requestId}`)
        .setLabel('Approve Role Request')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`rolerequest:deny:${requestId}`)
        .setLabel('Deny Role Request')
        .setStyle(ButtonStyle.Danger)
    );

    const message = await requestChannel.send({
      content: `${approverUser}`,
      embeds: [embed],
      components: [row],
      allowedMentions: {
        users: [approverUser.id],
      },
    });

    attachMessage(requestId, message.id);

    return interaction.editReply({
      embeds: [
        successEmbed(
          'Role request sent',
          `Request #${requestId} was sent to ${requestChannel} for ${approverUser} to review.`
        ),
      ],
    });
  },
};
