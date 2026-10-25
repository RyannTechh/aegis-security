const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { memberHasAnyRole, isOwner } = require('../../utils/checks');
const { globalStrip } = require('../../services/globalActionService');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('globalstrip')
    .setDescription('Remove manageable roles from a user in every shared server.')
    .addUserOption((o) => o.setName('user').setDescription('User').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(500)),
  async execute(interaction, client) {
    if (!isOwner(interaction.user.id) && !memberHasAnyRole(interaction.member, 'GLOBAL_MOD_ROLE_IDS')) {
      return interaction.reply({ embeds: [errorEmbed('No permission', 'You do not have a configured global moderation role.')], flags: MessageFlags.Ephemeral });
    }
    await interaction.deferReply();
    const user = interaction.options.getUser('user', true);
    const results = await globalStrip(client, user.id, interaction.options.getString('reason', true));
    await interaction.editReply({ embeds: [successEmbed('Global strip finished', `Successful: ${results.filter(r => r.ok).length}\nFailed: ${results.filter(r => !r.ok).length}`)] });
  },
};
