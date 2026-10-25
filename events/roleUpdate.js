const { Events, AuditLogEvent } = require('discord.js');
const { sendChannelLog } = require('../services/channelLogService');

function describeChanges(oldRole, newRole) {
  const changes = [];
  if (oldRole.name !== newRole.name) changes.push(`Name: **${oldRole.name}** → **${newRole.name}**`);
  if (oldRole.color !== newRole.color) changes.push(`Color: \`${oldRole.hexColor}\` → \`${newRole.hexColor}\``);
  if (oldRole.hoist !== newRole.hoist) changes.push(`Displayed separately: **${oldRole.hoist}** → **${newRole.hoist}**`);
  if (oldRole.mentionable !== newRole.mentionable) changes.push(`Mentionable: **${oldRole.mentionable}** → **${newRole.mentionable}**`);
  if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) changes.push('Permissions were changed.');
  return changes.join('\n') || 'Role settings were updated.';
}

module.exports = {
  name: Events.GuildRoleUpdate,
  async execute(client, oldRole, newRole) {
    const logs = await newRole.guild.fetchAuditLogs({ type: AuditLogEvent.RoleUpdate, limit: 5 }).catch(() => null);
    const entry = logs?.entries.find((item) => item.target?.id === newRole.id && Date.now() - item.createdTimestamp < 10_000);

    await sendChannelLog(client, 'ROLE_ACTION_LOG_CHANNEL_ID', {
      title: 'Role Edited',
      description: describeChanges(oldRole, newRole),
      color: 0xFEE75C,
      fields: [
        { name: 'Role', value: `${newRole}\n\`${newRole.id}\``, inline: true },
        { name: 'Executor', value: entry?.executor ? `<@${entry.executor.id}> (${entry.executor.tag})` : 'Unknown', inline: true },
      ],
    });
  },
};
