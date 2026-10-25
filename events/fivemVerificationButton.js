const { Events, MessageFlags } = require('discord.js');
const {
  getRecentJoin,
  getWindowMinutes,
  markVerified,
} = require('../services/fivemVerificationService');

module.exports = {
  name: Events.InteractionCreate,

  async execute(client, interaction) {
    if (!interaction.isButton()) return;
    if (interaction.customId !== 'fivemverify:getverified') return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const roleId = String(process.env.FIVEM_VERIFY_ROLE_ID || '').trim();

    if (!roleId) {
      return interaction.editReply({ content: '❌ Verification is not configured correctly.' });
    }

    const member = await interaction.guild.members
      .fetch(interaction.user.id)
      .catch(() => null);

    if (!member) {
      return interaction.editReply({ content: '❌ Your Discord member could not be found.' });
    }

    if (member.roles.cache.has(roleId)) {
      return interaction.editReply({ content: '✅ You are already verified.' });
    }

    const recentJoin = getRecentJoin(interaction.user.id);

    if (!recentJoin) {
      return interaction.editReply({
        content:
          '❌ **Verification Failed**\n\n'
          + `We could not detect this Discord account on the FiveM server within the last **${getWindowMinutes()} minutes**.\n\n`
          + 'Make sure Discord is running and connected to FiveM, fully join SALRP, then try again.',
      });
    }

    const role =
      interaction.guild.roles.cache.get(roleId)
      || await interaction.guild.roles.fetch(roleId).catch(() => null);

    if (!role || role.managed || !role.editable) {
      return interaction.editReply({
        content: '❌ The bot cannot assign the verified role. Put the bot role above it.',
      });
    }

    try {
      await member.roles.add(role, `FiveM verification passed for ${interaction.user.tag}`);
      markVerified(interaction.user.id);

      return interaction.editReply({
        content: `✅ **Verification Successful**\n\n${role} has been assigned.`,
      });
    } catch (error) {
      console.error('[FIVEM VERIFY] Role assignment failed:', error);
      return interaction.editReply({
        content: '❌ Verification passed, but the bot could not assign the role.',
      });
    }
  },
};
