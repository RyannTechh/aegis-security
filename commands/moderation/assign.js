const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { parseIds, canManageRole } = require('../../utils/checks');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('assign')
    .setDescription('Assign an authorized role.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
    .addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true)),
  async execute(interaction) {
    const member = interaction.options.getMember('user');
    const role = interaction.options.getRole('role', true);
    const allowed = parseIds(process.env.ASSIGNABLE_ROLE_IDS);

    if (!allowed.includes(role.id)) {
      return interaction.reply({ embeds: [errorEmbed('Not authorized', 'That role is not listed in ASSIGNABLE_ROLE_IDS.')], flags: MessageFlags.Ephemeral });
    }
    if (!role.editable || !canManageRole(interaction.member, role)) {
      return interaction.reply({ embeds: [errorEmbed('Cannot assign role', 'The role hierarchy does not allow this action.')], flags: MessageFlags.Ephemeral });
    }

    await member.roles.add(role, `Assigned by ${interaction.user.tag}`);
    return interaction.reply({ embeds: [successEmbed('Role assigned', `${role} was added to ${member}.`)] });
  },
};
