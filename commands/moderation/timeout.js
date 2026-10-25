const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a member.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
    .addIntegerOption((o) => o.setName('minutes').setDescription('Minutes').setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  async execute(interaction) {
    const member = interaction.options.getMember('user');
    const minutes = interaction.options.getInteger('minutes', true);
    const reason = interaction.options.getString('reason') || `Timed out by ${interaction.user.tag}`;

    if (!member?.moderatable) {
      return interaction.reply({ embeds: [errorEmbed('Cannot timeout', 'I cannot timeout that member.')], flags: MessageFlags.Ephemeral });
    }

    await member.timeout(minutes * 60_000, reason);
    return interaction.reply({ embeds: [successEmbed('Member timed out', `${member.user.tag} was timed out for ${minutes} minute(s).`)] });
  },
};
