const {
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');

const {
  getRoleRequest,
  resolveRoleRequest,
  memberCanApproveRole,
} = require('../services/roleRequestService');

module.exports = {
  name: Events.InteractionCreate,

  async execute(client, interaction) {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('rolerequest:')) return;

    const [, action, requestIdRaw] =
      interaction.customId.split(':');

    const requestId = Number(requestIdRaw);

    if (!Number.isInteger(requestId)) {
      return interaction.reply({
        content: 'Invalid role request.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const request = getRoleRequest(requestId);

    if (!request) {
      return interaction.reply({
        content: 'This role request no longer exists.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (request.status !== 'pending') {
      return interaction.reply({
        content: `This request has already been **${request.status}**.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    /*
     * Only the exact user selected in /rolerequest can use the buttons.
     */
    if (interaction.user.id !== request.approver_id) {
      return interaction.reply({
        content:
          'Only the user selected as the approver can use these buttons.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const guild = interaction.guild;

    if (!guild || guild.id !== request.guild_id) {
      return interaction.reply({
        content: 'This request belongs to another server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const approverMember = await guild.members
      .fetch(request.approver_id)
      .catch(() => null);

    const targetMember = await guild.members
      .fetch(request.target_user_id)
      .catch(() => null);

    const role = await guild.roles
      .fetch(request.role_id)
      .catch(() => null);

    if (!approverMember || !targetMember || !role) {
      return interaction.reply({
        content:
          'The approver, target user, or requested role could not be found.',
        flags: MessageFlags.Ephemeral,
      });
    }

    /*
     * No approver hierarchy check.
     * They only need one of the configured approval roles.
     */
    if (!memberCanApproveRole(approverMember, role.id)) {
      return interaction.reply({
        content:
          `You are no longer authorized to approve ${role}. `
          + 'You need one of the configured approver roles.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (action === 'approve') {
      if (role.managed || !role.editable) {
        return interaction.reply({
          content:
            'The bot cannot assign this role. Move the bot role above it.',
          flags: MessageFlags.Ephemeral,
        });
      }

      if (!targetMember.roles.cache.has(role.id)) {
        await targetMember.roles.add(
          role,
          `Role request #${requestId} approved by ${interaction.user.tag}`
        );
      }

      resolveRoleRequest(
        requestId,
        'approved',
        interaction.user.id
      );

      const approvedEmbed = EmbedBuilder.from(
        interaction.message.embeds[0]
      )
        .setColor(0x57F287)
        .addFields({
          name: 'Status',
          value:
            `✅ Approved by ${interaction.user}\n`
            + `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: false,
        });

      const disabledRow =
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(
              `rolerequest:approve:${requestId}`
            )
            .setLabel('Approved')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId(
              `rolerequest:deny:${requestId}`
            )
            .setLabel('Deny Role Request')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true)
        );

      return interaction.update({
        embeds: [approvedEmbed],
        components: [disabledRow],
      });
    }

    if (action === 'deny') {
      resolveRoleRequest(
        requestId,
        'denied',
        interaction.user.id
      );

      const deniedEmbed = EmbedBuilder.from(
        interaction.message.embeds[0]
      )
        .setColor(0xED4245)
        .addFields({
          name: 'Status',
          value:
            `❌ Denied by ${interaction.user}\n`
            + `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: false,
        });

      const disabledRow =
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(
              `rolerequest:approve:${requestId}`
            )
            .setLabel('Approve Role Request')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId(
              `rolerequest:deny:${requestId}`
            )
            .setLabel('Denied')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true)
        );

      return interaction.update({
        embeds: [deniedEmbed],
        components: [disabledRow],
      });
    }
  },
};
