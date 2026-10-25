const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((o) => o.setName('user').setDescription('Member to kick').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  async execute(interaction) {
    const member = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || `Kicked by ${interaction.user.tag}`;

    if (!member?.kickable) {
      return interaction.reply({ embeds: [errorEmbed('Cannot kick', 'I cannot kick that member.')], flags: MessageFlags.Ephemeral });
    }

    await member.kick(reason);
    return interaction.reply({ embeds: [successEmbed('Member kicked', `${member.user.tag} was kicked.\nReason: ${reason}`)] });
  },
};
