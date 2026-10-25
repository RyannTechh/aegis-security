const {
  SlashCommandBuilder,
  MessageFlags,
} = require('discord.js');

const { isOwner } = require('../../utils/checks');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaveguild')
    .setDescription('Force the bot to leave a server by guild ID.')
    .addStringOption((option) =>
      option
        .setName('guild_id')
        .setDescription('The ID of the server the bot should leave')
        .setRequired(true)
        .setMinLength(17)
        .setMaxLength(20)
    ),

  async execute(interaction, client) {
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

    const guildId = interaction.options.getString('guild_id', true).trim();

    if (!/^\d{17,20}$/.test(guildId)) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Invalid Guild ID',
            'Enter a valid Discord guild/server ID.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (guildId === interaction.guildId) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Use another server',
            'Run this command from a different server before making the bot leave the target server.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({
      flags: MessageFlags.Ephemeral,
    });

    let targetGuild = client.guilds.cache.get(guildId);

    if (!targetGuild) {
      targetGuild = await client.guilds.fetch(guildId).catch(() => null);
    }

    if (!targetGuild) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Server not found',
            `The bot is not currently in a server with ID \`${guildId}\`.`
          ),
        ],
      });
    }

    const guildName = targetGuild.name;

    try {
      await targetGuild.leave();
    } catch (error) {
      console.error(
        `[LEAVEGUILD] Failed to leave ${guildName} (${guildId}):`,
        error
      );

      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Failed to leave server',
            `The bot could not leave **${guildName}** (\`${guildId}\`).`
          ),
        ],
      });
    }

    return interaction.editReply({
      embeds: [
        successEmbed(
          'Server left',
          `The bot successfully left **${guildName}**.\nGuild ID: \`${guildId}\``
        ),
      ],
    });
  },
};
