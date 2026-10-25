const { Events, AuditLogEvent } = require('discord.js');
const { sendChannelLog } = require('../services/channelLogService');

module.exports = {
  name: Events.GuildRoleCreate,
  async execute(client, role) {
    const logs = await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleCreate, limit: 5 }).catch(() => null);
    const entry = logs?.entries.find((item) => item.target?.id === role.id && Date.now() - item.createdTimestamp < 10_000);

    await sendChannelLog(client, 'ROLE_ACTION_LOG_CHANNEL_ID', {
      title: 'Role Created',
      description: `${role} was created.`,
      color: 0x57F287,
      fields: [
        { name: 'Role', value: `${role.name}\n\`${role.id}\``, inline: true },
        { name: 'Executor', value: entry?.executor ? `<@${entry.executor.id}> (${entry.executor.tag})` : 'Unknown', inline: true },
        { name: 'Permissions', value: role.permissions.toArray().join(', ').slice(0, 1024) || 'None', inline: false },
      ],
    });
  },
};
