const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { isOwner } = require('../../utils/checks');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const lockdown = require('../../services/lockdownService');
module.exports = {
 data: new SlashCommandBuilder().setName('lockdown').setDescription('Emergency server lockdown controls.')
  .addSubcommand(s=>s.setName('start').setDescription('Lock the server down'))
  .addSubcommand(s=>s.setName('restore').setDescription('Restore pre-lockdown permissions'))
  .addSubcommand(s=>s.setName('status').setDescription('Check lockdown status')),
 async execute(interaction) {
  if (!isOwner(interaction.user.id)) return interaction.reply({embeds:[errorEmbed('Owner only','Only a configured bot owner can use lockdown.')],flags:MessageFlags.Ephemeral});
  const sub=interaction.options.getSubcommand();
  if(sub==='status'){const s=lockdown.state(interaction.guild.id);return interaction.reply({embeds:[infoEmbed('San Andreas Life Roleplay • Lockdown',s.active?`🔴 **ACTIVE**\nStarted by: <@${s.started_by}>\nSince: <t:${Math.floor(s.started_at/1000)}:F>`:'🟢 **INACTIVE**')],flags:MessageFlags.Ephemeral});}
  await interaction.deferReply({flags:MessageFlags.Ephemeral});
  const r=sub==='start'?await lockdown.start(interaction.guild,interaction.user.id):await lockdown.restore(interaction.guild,interaction.user.id);
  if(r.alreadyActive) return interaction.editReply({embeds:[errorEmbed('Already locked down','This server is already in lockdown.') ]});
  if(r.notActive) return interaction.editReply({embeds:[errorEmbed('Not locked down','There is no active lockdown to restore.') ]});
  return interaction.editReply({embeds:[successEmbed(sub==='start'?'Lockdown activated':'Lockdown restored',sub==='start'?`Locked **${r.changed}** channels. Failed: **${r.failed}**.`:`Restored **${r.restored}** channels. Failed: **${r.failed}**.`)]});
 }
};
