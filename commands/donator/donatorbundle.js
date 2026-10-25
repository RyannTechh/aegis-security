const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { listBundles, addBundle, removeBundle, syncMember } = require('../../services/donatorBundleService');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('donatorbundle')
    .setDescription('Manage automatic donator role associations.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((s) => s.setName('list').setDescription('List configured role associations'))
    .addSubcommand((s) => s.setName('add').setDescription('Create a role association')
      .addRoleOption((o) => o.setName('source_role').setDescription('Role that activates the bundle').setRequired(true))
      .addRoleOption((o) => o.setName('target_role').setDescription('Role automatically granted').setRequired(true)))
    .addSubcommand((s) => s.setName('remove').setDescription('Remove a role association')
      .addRoleOption((o) => o.setName('source_role').setDescription('Source role').setRequired(true))
      .addRoleOption((o) => o.setName('target_role').setDescription('Target role').setRequired(true)))
    .addSubcommand((s) => s.setName('sync').setDescription('Synchronize a member')
      .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      const rows = listBundles(interaction.guild.id);
      const text = rows.length
        ? rows.map((r, i) => `${i + 1}. <@&${r.source_role_id}> → <@&${r.target_role_id}>`).join('\n')
        : 'No donator bundles are configured.';
      return interaction.reply({ embeds: [infoEmbed('Donator bundles', text)] });
    }

    if (sub === 'sync') {
      const member = interaction.options.getMember('user');
      const result = await syncMember(member);
      return interaction.reply({ embeds: [successEmbed('Member synchronized', `Added: ${result.added}\nRemoved: ${result.removed}`)] });
    }

    const source = interaction.options.getRole('source_role', true);
    const target = interaction.options.getRole('target_role', true);

    if (sub === 'add') {
      if (!target.editable) {
        return interaction.reply({ embeds: [errorEmbed('Cannot manage target role', 'Move the bot role above the target role.')], flags: MessageFlags.Ephemeral });
      }
      addBundle(interaction.guild.id, source.id, target.id, interaction.user.id);
      return interaction.reply({ embeds: [successEmbed('Bundle added', `${source} now grants ${target}.`)] });
    }

    removeBundle(interaction.guild.id, source.id, target.id);
    return interaction.reply({ embeds: [successEmbed('Bundle removed', `${source} no longer grants ${target}.`)] });
  },
};
