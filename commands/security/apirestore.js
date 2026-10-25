const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { memberHasAnyRole, isOwner } = require('../../utils/checks');
const { saveSnapshot, restoreSnapshot } = require('../../services/backupService');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('apirestore')
    .setDescription('Save or restore the server configuration.')
    .addSubcommand((s) => s.setName('save').setDescription('Save the current roles and channels'))
    .addSubcommand((s) => s.setName('restore').setDescription('Restore missing roles and channels')),
  async execute(interaction) {
    if (!isOwner(interaction.user.id) && !memberHasAnyRole(interaction.member, 'API_RESTORE_ROLE_IDS')) {
      return interaction.reply({ embeds: [errorEmbed('No permission', 'You do not have a configured API restore role.')], flags: MessageFlags.Ephemeral });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'save') {
      const snapshot = saveSnapshot(interaction.guild, interaction.user.id);
      return interaction.reply({ embeds: [successEmbed('Backup saved', `Saved ${snapshot.roles.length} role(s) and ${snapshot.channels.length} channel(s).`)], flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const result = await restoreSnapshot(interaction.guild);
    return interaction.editReply({ embeds: [successEmbed('Restore complete', `Restored roles: ${result.restoredRoles}\nRestored channels: ${result.restoredChannels}`)] });
  },
};
