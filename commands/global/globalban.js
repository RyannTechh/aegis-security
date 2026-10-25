const {
  SlashCommandBuilder,
  MessageFlags,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const db = require('../../database/database');
const { memberHasAnyRole, isOwner } = require('../../utils/checks');
const { globalBan } = require('../../services/globalActionService');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

function createCaseId() {
  return `GB-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function buildCaseEmbed({ caseId, interaction, offender, reason, dmSent, results }) {
  const failed = results.filter((r) => !r.ok).length;
  const banned = results.filter((r) => r.ok && !r.skipped).length;
  const alreadyBanned = results.filter((r) => r.ok && r.skipped).length;
  const unix = Math.floor(Date.now() / 1000);

  return new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle(`Ban Case: ${caseId}`)
    .setDescription(
      'A Management Member will be required to review this ban. False bans can lead to punishments.\n\n' +
      '**Please make sure to right click and create a thread with evidence.**'
    )
    .addFields(
      {
        name: 'Staff Member',
        value: `${interaction.user} (${interaction.user.username})`,
        inline: true,
      },
      {
        name: 'Staff Member ID',
        value: `\`${interaction.user.id}\``,
        inline: true,
      },
      {
        name: 'Offender',
        value: `${offender} (${offender.username})`,
        inline: true,
      },
      {
        name: 'Offender ID',
        value: `\`${offender.id}\``,
        inline: true,
      },
      {
        name: 'Ban Information',
        value:
          `\`\`\`yaml\n` +
          `[GLOBAL-BAN : ${offender.id}]\n` +
          `- Reason: ${reason}\n` +
          `- Offender Username: ${offender.username}\n` +
          `- Offender ID: ${offender.id}\n\n` +
          `[AUTHENTICATION]\n` +
          `- Authenticated: <t:${unix}:F>\n` +
          `- DM Sent: ${dmSent ? 'Yes' : 'No'}\n` +
          `- Banned: ${banned}\n` +
          `- Already Banned: ${alreadyBanned}\n` +
          `- Failed: ${failed}\n` +
          `\`\`\``
      }
    )
    .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined })
    .setTimestamp();
}

function buildButtons(caseId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`gb_approve:${caseId}`)
      .setLabel('Approve Global Ban')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`gb_revoke:${caseId}`)
      .setLabel('Revoke Global Ban')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`gb_remind:${caseId}`)
      .setLabel('Remind Global Ban Proof')
      .setStyle(ButtonStyle.Secondary)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('globalban')
    .setDescription('Globally ban a user and create a management review case.')
    .addUserOption((option) =>
      option.setName('user').setDescription('User to globally ban').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for the global ban').setRequired(true).setMaxLength(500)
    ),

  async execute(interaction, client) {
    const allowed = isOwner(interaction.user.id)
      || memberHasAnyRole(interaction.member, 'GLOBAL_MOD_ROLE_IDS');

    if (!allowed) {
      return interaction.reply({
        embeds: [errorEmbed('No permission', 'You do not have a configured global moderation role.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    const offender = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true).trim();

    if (offender.id === interaction.user.id) {
      return interaction.reply({ embeds: [errorEmbed('Invalid target', 'You cannot globally ban yourself.')], flags: MessageFlags.Ephemeral });
    }
    if (offender.id === client.user.id || isOwner(offender.id)) {
      return interaction.reply({ embeds: [errorEmbed('Protected target', 'That user cannot be globally banned.')], flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const caseId = createCaseId();
    const outcome = await globalBan(client, offender.id, reason, interaction.user.id, {
      caseId,
      sourceGuildName: interaction.guild.name,
      sendDM: true,
    });

    const reviewChannelId = process.env.GLOBAL_BAN_REVIEW_CHANNEL_ID || process.env.GLOBAL_LOG_CHANNEL_ID;
    const reviewChannel = reviewChannelId
      ? (client.channels.cache.get(reviewChannelId) || await client.channels.fetch(reviewChannelId).catch(() => null))
      : null;

    if (!reviewChannel?.isTextBased()) {
      throw new Error('GLOBAL_BAN_REVIEW_CHANNEL_ID is missing or does not point to a text channel.');
    }

    const embed = buildCaseEmbed({
      caseId,
      interaction,
      offender,
      reason,
      dmSent: outcome.dmSent,
      results: outcome.results,
    });

    const reviewMessage = await reviewChannel.send({
      content: process.env.GLOBAL_BAN_REVIEW_PING_ROLE_ID
        ? `<@&${process.env.GLOBAL_BAN_REVIEW_PING_ROLE_ID}>`
        : undefined,
      embeds: [embed],
      components: [buildButtons(caseId)],
      allowedMentions: { roles: process.env.GLOBAL_BAN_REVIEW_PING_ROLE_ID ? [process.env.GLOBAL_BAN_REVIEW_PING_ROLE_ID] : [] },
    });

    db.prepare(`
      INSERT INTO global_ban_cases
      (case_id, guild_id, channel_id, message_id, offender_id, offender_tag, staff_id, reason, status, dm_sent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      caseId,
      interaction.guild.id,
      reviewChannel.id,
      reviewMessage.id,
      offender.id,
      offender.tag,
      interaction.user.id,
      reason,
      outcome.dmSent ? 1 : 0,
      Date.now()
    );

    return interaction.editReply({
      embeds: [successEmbed('Global ban submitted', `Case \`${caseId}\` was created in ${reviewChannel}.\nDM sent: **${outcome.dmSent ? 'Yes' : 'No'}**`)],
    });
  },
};
