const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../database/database');
const { isOwner } = require('../../utils/checks');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('globalblacklist')
    .setDescription('Manage users blocked from global unbans.')
    .addSubcommand((s) => s.setName('set').setDescription('Block a user from global unbans')
      .addStringOption((o) => o.setName('user_id').setDescription('User ID').setRequired(true))
      .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(500)))
    .addSubcommand((s) => s.setName('remove').setDescription('Remove the global unban block')
      .addStringOption((o) => o.setName('user_id').setDescription('User ID').setRequired(true))),
  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ embeds: [errorEmbed('Owner only', 'Only configured bot owners can use this command.')], flags: MessageFlags.Ephemeral });
    }

    const sub = interaction.options.getSubcommand();
    const userId = interaction.options.getString('user_id', true);

    if (sub === 'set') {
      const reason = interaction.options.getString('reason', true);
      db.prepare(`
        INSERT OR REPLACE INTO global_blacklists
        (user_id, reason, added_by, created_at)
        VALUES (?, ?, ?, ?)
      `).run(userId, reason, interaction.user.id, Date.now());
      return interaction.reply({ embeds: [successEmbed('Global blacklist set', `<@${userId}> cannot be globally unbanned.`)] });
    }

    db.prepare('DELETE FROM global_blacklists WHERE user_id = ?').run(userId);
    return interaction.reply({ embeds: [successEmbed('Global blacklist removed', `<@${userId}> can now be globally unbanned.`)] });
  },
};
