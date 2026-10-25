const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('manualverify')
    .setDescription('Grant the configured verified role.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)),
  async execute(interaction) {
    const roleId = process.env.VERIFIED_ROLE_ID;
    const role = interaction.guild.roles.cache.get(roleId);
    const member = interaction.options.getMember('user');

    if (!role?.editable) {
      return interaction.reply({ embeds: [errorEmbed('Invalid configuration', 'VERIFIED_ROLE_ID is missing or the role cannot be managed.')], flags: MessageFlags.Ephemeral });
    }

    await member.roles.add(role, `Manual verification by ${interaction.user.tag}`);
    return interaction.reply({ embeds: [successEmbed('Member verified', `${role} was added to ${member}.`)] });
  },
};
