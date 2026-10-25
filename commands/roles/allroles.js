const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { isOwner } = require('../../utils/checks');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('allroles')
    .setDescription('Give every manageable role to a member. Owner only.')
    .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)),
  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ embeds: [errorEmbed('Owner only', 'Only configured bot owners can use this command.')], flags: MessageFlags.Ephemeral });
    }

    const member = interaction.options.getMember('user');
    const roles = interaction.guild.roles.cache.filter(
      (role) => role.id !== interaction.guild.id && role.editable && !role.managed
    );

    await member.roles.add(roles, `All roles command by ${interaction.user.tag}`);
    return interaction.reply({ embeds: [successEmbed('Roles assigned', `${roles.size} role(s) were assigned to ${member}.`)] });
  },
};
