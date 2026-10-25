const {
  SlashCommandBuilder,
  MessageFlags,
} = require('discord.js');

const {
  memberHasAnyRole,
  isOwner,
} = require('../../utils/checks');

const {
  globalUnban,
  cleanUserId,
} = require('../../services/globalActionService');

const {
  successEmbed,
  errorEmbed,
} = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unglobalban')
    .setDescription('Unban a user from every server the bot is in.')
    .addStringOption((option) =>
      option
        .setName('user_id')
        .setDescription('Discord user ID or mention')
        .setRequired(true)
        .setMaxLength(30)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Reason for the global unban')
        .setRequired(false)
        .setMaxLength(500)
    ),

  async execute(interaction, client) {
    const allowed =
      isOwner(interaction.user.id)
      || memberHasAnyRole(interaction.member, 'GLOBAL_MOD_ROLE_IDS');

    if (!allowed) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'No permission',
            'You do not have a configured global moderation role.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const rawUserId = interaction.options.getString('user_id', true);
    const userId = cleanUserId(rawUserId);

    if (!userId) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Invalid user',
            'Enter a valid Discord user ID or user mention.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const suppliedReason = interaction.options.getString('reason');
    const reason =
      typeof suppliedReason === 'string' && suppliedReason.trim().length > 0
        ? suppliedReason.trim()
        : `Global unban by ${interaction.user.tag}`;

    await interaction.deferReply();

    const results = await globalUnban(client, userId, reason);

    const unbanned = results.filter(
      (result) => result.ok && !result.skipped
    ).length;

    const notBanned = results.filter(
      (result) => result.ok && result.skipped
    ).length;

    const failedResults = results.filter(
      (result) => !result.ok
    );

    const failurePreview = failedResults
      .slice(0, 8)
      .map((result) => {
        const guildName =
          typeof result.guild === 'string' && result.guild.length > 0
            ? result.guild
            : result.guildId || 'Unknown server';

        const errorText =
          typeof result.error === 'string' && result.error.length > 0
            ? result.error
            : 'Unknown error';

        return `• **${guildName}** — ${errorText}`;
      })
      .join('\n');

    let description =
      `Target: <@${userId}> (\`${userId}\`)\n`
      + `Unbanned: **${unbanned}**\n`
      + `Not banned: **${notBanned}**\n`
      + `Failed: **${failedResults.length}**`;

    if (failurePreview) {
      description += `\n\n**Failures**\n${failurePreview}`;
    }

    if (failedResults.length > 8) {
      description += `\n• Plus ${failedResults.length - 8} more failure(s).`;
    }

    return interaction.editReply({
      embeds: [
        successEmbed(
          'Global unban finished',
          description
        ),
      ],
    });
  },
};
