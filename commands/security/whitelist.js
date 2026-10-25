const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { WHITELIST_PERMISSIONS } = require('../../utils/constants');
const { isOwner } = require('../../utils/checks');
const { addWhitelist, removeWhitelist, getWhitelist } = require('../../services/permissionService');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');

function permissionChoices(option) {
  return option.addChoices(...WHITELIST_PERMISSIONS.map((name) => ({ name, value: name })));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Manage bot security whitelist permissions.')
    .addSubcommand((s) => s.setName('add').setDescription('Add a permission')
      .addUserOption((o) => o.setName('user').setDescription('User').setRequired(true))
      .addStringOption((o) => permissionChoices(o.setName('permission').setDescription('Permission').setRequired(true))))
    .addSubcommand((s) => s.setName('remove').setDescription('Remove a permission')
      .addUserOption((o) => o.setName('user').setDescription('User').setRequired(true))
      .addStringOption((o) => permissionChoices(o.setName('permission').setDescription('Permission').setRequired(true))))
    .addSubcommand((s) => s.setName('view').setDescription('View a user’s permissions')
      .addUserOption((o) => o.setName('user').setDescription('User').setRequired(true))),
  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ embeds: [errorEmbed('Owner only', 'Only configured bot owners can manage the whitelist.')], flags: MessageFlags.Ephemeral });
    }

    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user', true);

    if (sub === 'view') {
      const rows = getWhitelist(interaction.guild.id, user.id);
      const text = rows.length ? rows.map((r) => `• ${r.permission}`).join('\n') : 'No permissions assigned.';
      return interaction.reply({ embeds: [infoEmbed(`Whitelist: ${user.tag}`, text)], flags: MessageFlags.Ephemeral });
    }

    const permission = interaction.options.getString('permission', true);

    if (sub === 'add') {
      addWhitelist(interaction.guild.id, user.id, permission, interaction.user.id);
      return interaction.reply({ embeds: [successEmbed('Whitelist updated', `${user} received **${permission}**.`)] });
    }

    removeWhitelist(interaction.guild.id, user.id, permission);
    return interaction.reply({ embeds: [successEmbed('Whitelist updated', `**${permission}** was removed from ${user}.`)] });
  },
};
