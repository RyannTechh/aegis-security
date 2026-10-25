const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../database/database');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('temprole')
    .setDescription('Manage temporary roles.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((s) => s.setName('add').setDescription('Give a temporary role')
      .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
      .addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true))
      .addIntegerOption((o) => o.setName('minutes').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(525600)))
    .addSubcommand((s) => s.setName('remove').setDescription('Remove a temporary role early')
      .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
      .addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand((s) => s.setName('list').setDescription('List the next 25 expiring temporary roles')),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      const rows = db.prepare(`
        SELECT user_id, role_id, expires_at FROM temporary_roles
        WHERE guild_id = ? ORDER BY expires_at ASC LIMIT 25
      `).all(interaction.guild.id);

      const text = rows.length
        ? rows.map((r, i) => `${i + 1}. <@${r.user_id}> — <@&${r.role_id}> — <t:${Math.floor(r.expires_at / 1000)}:R>`).join('\n')
        : 'No temporary roles are scheduled.';

      return interaction.reply({ embeds: [infoEmbed('Temporary roles', text)] });
    }

    const member = interaction.options.getMember('user');
    const role = interaction.options.getRole('role', true);

    if (!role.editable) {
      return interaction.reply({ embeds: [errorEmbed('Cannot manage role', 'The bot cannot manage that role.')], flags: MessageFlags.Ephemeral });
    }

    if (sub === 'add') {
      const minutes = interaction.options.getInteger('minutes', true);
      const expiresAt = Date.now() + minutes * 60_000;

      await member.roles.add(role, `Temporary role by ${interaction.user.tag}`);
      db.prepare(`
        INSERT OR REPLACE INTO temporary_roles
        (guild_id, user_id, role_id, expires_at, added_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(interaction.guild.id, member.id, role.id, expiresAt, interaction.user.id, Date.now());

      return interaction.reply({ embeds: [successEmbed('Temporary role added', `${role} was added to ${member} until <t:${Math.floor(expiresAt / 1000)}:F>.`)] });
    }

    await member.roles.remove(role, `Temporary role removed early by ${interaction.user.tag}`);
    db.prepare(`
      DELETE FROM temporary_roles WHERE guild_id = ? AND user_id = ? AND role_id = ?
    `).run(interaction.guild.id, member.id, role.id);

    return interaction.reply({ embeds: [successEmbed('Temporary role removed', `${role} was removed from ${member}.`)] });
  },
};
