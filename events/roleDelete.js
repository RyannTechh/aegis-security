const { Events, AuditLogEvent } = require('discord.js');
const { sendChannelLog } = require('../services/channelLogService');

module.exports = {
  name: Events.GuildRoleDelete,
  async execute(client, role) {
    const logs = await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleDelete, limit: 5 }).catch(() => null);
    const entry = logs?.entries.find((item) => item.target?.id === role.id && Date.now() - item.createdTimestamp < 10_000);

    await sendChannelLog(client, 'ROLE_ACTION_LOG_CHANNEL_ID', {
      title: 'Role Deleted',
      description: `A role named **${role.name}** was deleted.`,
      color: 0xED4245,
      fields: [
        { name: 'Role ID', value: `\`${role.id}\``, inline: true },
        { name: 'Executor', value: entry?.executor ? `<@${entry.executor.id}> (${entry.executor.tag})` : 'Unknown', inline: true },
      ],
    });
  },
};
