const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { memberHasAnyRole, isOwner } = require('../../utils/checks');
const { globalBan } = require('../../services/globalActionService');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('massglobalban')
    .setDescription('Globally ban up to 20 user IDs.')
    .addStringOption((o) => o.setName('user_ids').setDescription('Comma or space separated user IDs').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(500)),
  async execute(interaction, client) {
    if (!isOwner(interaction.user.id) && !memberHasAnyRole(interaction.member, 'GLOBAL_MOD_ROLE_IDS')) {
      return interaction.reply({ embeds: [errorEmbed('No permission', 'You do not have a configured global moderation role.')], flags: MessageFlags.Ephemeral });
    }

    const ids = [...new Set(interaction.options.getString('user_ids', true).split(/[,\s]+/).filter(id => /^\d{17,20}$/.test(id)))];
    if (!ids.length || ids.length > 20) {
      return interaction.reply({ embeds: [errorEmbed('Invalid IDs', 'Provide between 1 and 20 valid Discord user IDs.')], flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply();
    const reason = interaction.options.getString('reason', true);
    for (const id of ids) {
      await globalBan(client, id, reason, interaction.user.id);
    }

    await interaction.editReply({ embeds: [successEmbed('Mass global ban finished', `${ids.length} user(s) were processed.`)] });
  },
};
