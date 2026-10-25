const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((o) => o.setName('user').setDescription('Member to ban').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || `Banned by ${interaction.user.tag}`;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (member && !member.bannable) {
      return interaction.reply({ embeds: [errorEmbed('Cannot ban', 'I cannot ban that member.')], flags: MessageFlags.Ephemeral });
    }

    await interaction.guild.members.ban(user.id, { reason });
    return interaction.reply({ embeds: [successEmbed('Member banned', `${user.tag} was banned.\nReason: ${reason}`)] });
  },
};
