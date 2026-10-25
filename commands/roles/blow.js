const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { parseIds, isOwner } = require('../../utils/checks');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blow')
    .setDescription('Remove all configured pack roles from every member. Owner only.'),
  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ embeds: [errorEmbed('Owner only', 'Only configured bot owners can use this command.')], flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply();
    const roleIds = parseIds(process.env.BLOW_ROLE_IDS);
    const members = await interaction.guild.members.fetch();
    let removals = 0;

    for (const member of members.values()) {
      const roles = roleIds
        .map((id) => interaction.guild.roles.cache.get(id))
        .filter((role) => role?.editable && member.roles.cache.has(role.id));

      if (roles.length) {
        await member.roles.remove(roles, `Blow command by ${interaction.user.tag}`).catch(() => null);
        removals += roles.length;
      }
    }

    await interaction.editReply({ embeds: [successEmbed('Pack roles removed', `${removals} role assignment(s) were removed.`)] });
  },
};
