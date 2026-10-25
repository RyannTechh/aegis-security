const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../database/database');
const { PUNISHMENTS } = require('../../utils/constants');
const { hasWhitelist } = require('../../services/permissionService');
const { isOwner } = require('../../utils/checks');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roleprotect')
    .setDescription('Manage protected roles.')
    .addSubcommand((s) => s.setName('add').setDescription('Protect a role')
      .addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true))
      .addStringOption((o) => o.setName('punishment').setDescription('Punishment').setRequired(true)
        .addChoices(...PUNISHMENTS.map((p) => ({ name: p, value: p })))))
    .addSubcommand((s) => s.setName('remove').setDescription('Remove protection')
      .addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand((s) => s.setName('view').setDescription('View all protected roles'))
    .addSubcommand((s) => s.setName('status').setDescription('Check role protection configuration'))
    .addSubcommand((s) => s.setName('cleanup').setDescription('Remove deleted roles from the database')),
  async execute(interaction) {
    if (!isOwner(interaction.user.id) && !hasWhitelist(interaction.guild.id, interaction.user.id, 'Role-Protect')) {
      return interaction.reply({ embeds: [errorEmbed('No permission', 'You need the Role-Protect whitelist permission.')], flags: MessageFlags.Ephemeral });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const role = interaction.options.getRole('role', true);
      const punishment = interaction.options.getString('punishment', true);
      db.prepare(`
        INSERT OR REPLACE INTO protected_roles
        (guild_id, role_id, punishment, created_by, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(interaction.guild.id, role.id, punishment, interaction.user.id, Date.now());
      return interaction.reply({ embeds: [successEmbed('Role protected', `${role} is protected with punishment **${punishment}**.`)] });
    }

    if (sub === 'remove') {
      const role = interaction.options.getRole('role', true);
      db.prepare('DELETE FROM protected_roles WHERE guild_id = ? AND role_id = ?')
        .run(interaction.guild.id, role.id);
      return interaction.reply({ embeds: [successEmbed('Protection removed', `${role} is no longer protected.`)] });
    }

    if (sub === 'cleanup') {
      const rows = db.prepare('SELECT role_id FROM protected_roles WHERE guild_id = ?').all(interaction.guild.id);
      let removed = 0;
      for (const row of rows) {
        if (!interaction.guild.roles.cache.has(row.role_id)) {
          db.prepare('DELETE FROM protected_roles WHERE guild_id = ? AND role_id = ?').run(interaction.guild.id, row.role_id);
          removed++;
        }
      }
      return interaction.reply({ embeds: [successEmbed('Cleanup complete', `${removed} deleted or unknown role(s) were removed.`)] });
    }

    const rows = db.prepare(`
      SELECT role_id, punishment FROM protected_roles
      WHERE guild_id = ? ORDER BY created_at ASC
    `).all(interaction.guild.id);

    if (sub === 'status') {
      return interaction.reply({ embeds: [infoEmbed('Role protection status', `Protected roles: **${rows.length}**\nAudit Log permission required: **Yes**\nAvailable punishments: ${PUNISHMENTS.join(', ')}`)] });
    }

    const text = rows.length
      ? rows.map((r, i) => `${i + 1}. <@&${r.role_id}> — **${r.punishment}**`).join('\n')
      : 'No roles are protected.';
    return interaction.reply({ embeds: [infoEmbed('Protected roles', text)] });
  },
};
