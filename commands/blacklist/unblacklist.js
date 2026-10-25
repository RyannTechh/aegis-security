const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../database/database');
const { memberHasAnyRole, isOwner } = require('../../utils/checks');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unblacklist')
    .setDescription('Remove a local blacklist.')
    .addStringOption((o) => o.setName('user_id').setDescription('User ID').setRequired(true)),
  async execute(interaction) {
    if (!isOwner(interaction.user.id) && !memberHasAnyRole(interaction.member, 'BLACKLIST_ROLE_IDS')) {
      return interaction.reply({ embeds: [errorEmbed('No permission', 'You do not have a configured blacklist role.')], flags: MessageFlags.Ephemeral });
    }

    const userId = interaction.options.getString('user_id', true);
    const changes = db.prepare(
      'DELETE FROM blacklists WHERE guild_id = ? AND user_id = ?'
    ).run(interaction.guild.id, userId).changes;

    return interaction.reply({ embeds: [successEmbed('Blacklist updated', changes ? `<@${userId}> was unblacklisted.` : 'No blacklist entry was found.')] });
  },
};
