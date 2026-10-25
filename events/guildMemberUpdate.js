const { Events, AuditLogEvent } = require('discord.js');
const { handleProtectedRoleChange } = require('../services/roleProtectionService');
const { syncMember } = require('../services/donatorBundleService');
const { sendChannelLog } = require('../services/channelLogService');

module.exports = {
  name: Events.GuildMemberUpdate,
  async execute(client, oldMember, newMember) {
    const added = newMember.roles.cache.filter((role) => !oldMember.roles.cache.has(role.id));
    const removed = oldMember.roles.cache.filter((role) => !newMember.roles.cache.has(role.id));

    if (added.size || removed.size) {
      const logs = await newMember.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberRoleUpdate,
        limit: 8,
      }).catch(() => null);

      const entry = logs?.entries.find(
        (item) => item.target?.id === newMember.id && Date.now() - item.createdTimestamp < 10_000
      );

      const fields = [
        { name: 'Member', value: `${newMember}\n\`${newMember.id}\``, inline: true },
        { name: 'Executor', value: entry?.executor ? `<@${entry.executor.id}> (${entry.executor.tag})` : 'Unknown or automated', inline: true },
      ];

      if (added.size) {
        fields.push({
          name: `Roles Added (${added.size})`,
          value: added.map((role) => `${role} (\`${role.id}\`)`).join('\n').slice(0, 1024),
          inline: false,
        });
      }

      if (removed.size) {
        fields.push({
          name: `Roles Removed (${removed.size})`,
          value: removed.map((role) => `${role} (\`${role.id}\`)`).join('\n').slice(0, 1024),
          inline: false,
        });
      }

      await sendChannelLog(client, 'ROLE_ACTION_LOG_CHANNEL_ID', {
        title: 'Member Roles Updated',
        description: `Role assignments changed for ${newMember}.`,
        color: added.size && removed.size ? 0xFEE75C : added.size ? 0x57F287 : 0xED4245,
        thumbnail: newMember.user.displayAvatarURL({ size: 256 }),
        fields,
      });
    }

    await handleProtectedRoleChange(oldMember, newMember).catch(console.error);
    await syncMember(newMember).catch(() => null);
  },
};
