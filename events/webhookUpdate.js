const { Events, AuditLogEvent } = require('discord.js');
const { sendChannelLog } = require('../services/channelLogService');

module.exports = {
  name: Events.WebhooksUpdate,
  async execute(client, channel) {
    const guild = channel.guild;
    const logs = await guild.fetchAuditLogs({ limit: 8 }).catch(() => null);
    if (!logs) return;

    const recent = logs.entries.find((entry) => {
      const validTypes = [
        AuditLogEvent.WebhookCreate,
        AuditLogEvent.WebhookDelete,
        AuditLogEvent.WebhookUpdate,
      ];
      return validTypes.includes(entry.action)
        && Date.now() - entry.createdTimestamp < 12_000;
    });

    if (!recent) return;

    const actionNames = {
      [AuditLogEvent.WebhookCreate]: 'Webhook Created',
      [AuditLogEvent.WebhookDelete]: 'Webhook Deleted',
      [AuditLogEvent.WebhookUpdate]: 'Webhook Edited',
    };

    const webhookName = recent.target?.name || 'Unknown webhook';
    const webhookId = recent.target?.id || 'Unknown';
    const executor = recent.executor ? `<@${recent.executor.id}> (${recent.executor.tag})` : 'Unknown';

    await sendChannelLog(client, 'WEBHOOK_LOG_CHANNEL_ID', {
      title: actionNames[recent.action] || 'Webhook Action',
      description: `A webhook action was detected in <#${channel.id}>.`,
      color: recent.action === AuditLogEvent.WebhookDelete ? 0xED4245 : 0xFEE75C,
      fields: [
        { name: 'Webhook', value: `${webhookName}\n\`${webhookId}\``, inline: true },
        { name: 'Executor', value: executor, inline: true },
        { name: 'Channel', value: `<#${channel.id}>\n\`${channel.id}\``, inline: true },
      ],
    });
  },
};
