const { Events } = require('discord.js');
const { sendChannelLog } = require('../services/channelLogService');

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(client, member) {
    const roles = member.roles.cache
      .filter((role) => role.id !== member.guild.id)
      .sort((a, b) => b.position - a.position)
      .map((role) => `<@&${role.id}>`);

    const roleText = roles.length ? roles.join(', ').slice(0, 1024) : 'No roles';

    await sendChannelLog(client, 'LEAVE_LOG_CHANNEL_ID', {
      title: 'Member Left',
      description: `${member.user.tag} left **${member.guild.name}**.`,
      color: 0xED4245,
      thumbnail: member.user.displayAvatarURL({ size: 256 }),
      fields: [
        { name: 'User', value: `<@${member.id}>\n\`${member.id}\``, inline: true },
        { name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`, inline: true },
        { name: `Roles (${roles.length})`, value: roleText, inline: false },
      ],
    });

    if (member.user.bot) {
      await sendChannelLog(client, 'BOT_DETECTION_LOG_CHANNEL_ID', {
        title: 'Bot Left Server',
        description: `A bot account left **${member.guild.name}**.`,
        color: 0xED4245,
        thumbnail: member.user.displayAvatarURL({ size: 256 }),
        fields: [
          { name: 'Bot', value: `<@${member.id}> (${member.user.tag})`, inline: true },
          { name: 'Bot ID', value: `\`${member.id}\``, inline: true },
        ],
      });
    }
  },
};
