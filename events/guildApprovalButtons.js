const {
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');

const {
  isOwner,
} = require('../utils/checks');

const {
  APPROVAL_GUILD_ID,
  APPROVAL_CHANNEL_ID,
  getApproval,
  setApprovalStatus,
} = require('../services/guildApprovalService');

module.exports = {
  name: Events.InteractionCreate,

  async execute(client, interaction) {
    if (!interaction.isButton()) {
      return;
    }

    if (!interaction.customId.startsWith('guildapproval:')) {
      return;
    }

    if (
      interaction.guildId !== APPROVAL_GUILD_ID
      || interaction.channelId !== APPROVAL_CHANNEL_ID
    ) {
      return interaction.reply({
        content: 'This approval button can only be used in the configured approval channel.',
        flags: MessageFlags.Ephemeral,
      });
    }

    /*
     * Approval/denial is owner-only.
     */
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        content: 'Only configured bot owners can approve or deny servers.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const [, action, guildId] =
      interaction.customId.split(':');

    if (
      !['approve', 'deny'].includes(action)
      || !/^\d{17,20}$/.test(guildId)
    ) {
      return interaction.reply({
        content: 'Invalid guild approval request.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const approval = getApproval(guildId);

    if (!approval) {
      return interaction.reply({
        content: 'This approval request no longer exists.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (approval.status !== 'pending') {
      return interaction.reply({
        content:
          `This server has already been **${approval.status}**.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const targetGuild =
      client.guilds.cache.get(guildId)
      || await client.guilds.fetch(guildId).catch(() => null);

    if (action === 'approve') {
      if (!targetGuild) {
        setApprovalStatus(
          guildId,
          'missing',
          interaction.user.id
        );

        return interaction.reply({
          content:
            'The bot is no longer in that server, so it cannot be approved.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const changed = setApprovalStatus(
        guildId,
        'approved',
        interaction.user.id
      );

      if (!changed) {
        return interaction.reply({
          content: 'This approval request was already handled.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const embed = interaction.message.embeds[0]
        ? EmbedBuilder.from(interaction.message.embeds[0])
        : new EmbedBuilder()
            .setTitle('Server Approval');

      embed
        .setColor(0x57F287)
        .addFields({
          name: 'Decision',
          value:
            `✅ **Approved** by ${interaction.user}\n`
            + `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: false,
        });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`guildapproval:approve:${guildId}`)
          .setLabel('Approved')
          .setStyle(ButtonStyle.Success)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`guildapproval:deny:${guildId}`)
          .setLabel('Deny & Leave')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(true)
      );

      return interaction.update({
        embeds: [embed],
        components: [row],
      });
    }

    /*
     * Mark denied before leaving so the decision is persisted even if
     * Discord removes the guild from cache immediately afterward.
     */
    const changed = setApprovalStatus(
      guildId,
      'denied',
      interaction.user.id
    );

    if (!changed) {
      return interaction.reply({
        content: 'This approval request was already handled.',
        flags: MessageFlags.Ephemeral,
      });
    }

    let leaveSucceeded = false;
    let leaveError = null;

    if (targetGuild) {
      try {
        await targetGuild.leave();
        leaveSucceeded = true;
      } catch (error) {
        leaveError = error;
      }
    }

    const embed = interaction.message.embeds[0]
      ? EmbedBuilder.from(interaction.message.embeds[0])
      : new EmbedBuilder()
          .setTitle('Server Approval');

    embed
      .setColor(0xED4245)
      .addFields({
        name: 'Decision',
        value:
          `❌ **Denied** by ${interaction.user}\n`
          + `<t:${Math.floor(Date.now() / 1000)}:F>\n`
          + (
            targetGuild
              ? leaveSucceeded
                ? 'Bot successfully left the server.'
                : `Bot could not leave: \`${String(leaveError?.message || 'Unknown error').slice(0, 500)}\``
              : 'Bot was already no longer in the server.'
          ),
        inline: false,
      });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`guildapproval:approve:${guildId}`)
        .setLabel('Approve Server')
        .setStyle(ButtonStyle.Success)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`guildapproval:deny:${guildId}`)
        .setLabel('Denied')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(true)
    );

    return interaction.update({
      embeds: [embed],
      components: [row],
    });
  },
};
