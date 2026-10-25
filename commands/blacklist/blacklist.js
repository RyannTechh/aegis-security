const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../database/database');
const { memberHasAnyRole, isOwner } = require('../../utils/checks');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Blacklist a user in this server.')
    .addUserOption((o) => o.setName('user').setDescription('User').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(500)),
  async execute(interaction) {
    if (!isOwner(interaction.user.id) && !memberHasAnyRole(interaction.member, 'BLACKLIST_ROLE_IDS')) {
      return interaction.reply({ embeds: [errorEmbed('No permission', 'You do not have a configured blacklist role.')], flags: MessageFlags.Ephemeral });
    }

    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    db.prepare(`
      INSERT OR REPLACE INTO blacklists
      (guild_id, user_id, reason, added_by, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(interaction.guild.id, user.id, reason, interaction.user.id, Date.now());

    return interaction.reply({ embeds: [successEmbed('User blacklisted', `${user.tag} was blacklisted.\nReason: ${reason}`)] });
  },
};
