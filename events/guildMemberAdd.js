const {
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const db = require('../database/database');
const { sendChannelLog } = require('../services/channelLogService');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(client, member) {
    const globalBan = db.prepare(
      'SELECT reason FROM global_bans WHERE user_id = ?'
    ).get(member.id);

    if (globalBan && member.bannable) {
      await member.ban({ reason: `Stored global ban: ${globalBan.reason}` }).catch(() => null);
      return;
    }

    if (member.user.bot) {
      await sendChannelLog(client, 'BOT_DETECTION_LOG_CHANNEL_ID', {
        title: 'Bot Joined Server',
        description: `A bot account joined **${member.guild.name}**.`,
        color: 0x57F287,
        thumbnail: member.user.displayAvatarURL({ size: 256 }),
        fields: [
          { name: 'Bot', value: `<@${member.id}> (${member.user.tag})`, inline: true },
          { name: 'Bot ID', value: `\`${member.id}\``, inline: true },
          { name: 'Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
        ],
      });
      return;
    }

    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const accountAge = Date.now() - member.user.createdTimestamp;
    const hasDefaultAvatar = member.user.avatar === null;
    const isNewAccount = accountAge < sevenDays;

    if (!hasDefaultAvatar && !isNewAccount) return;

    const reasons = [];
    if (hasDefaultAvatar) reasons.push('Uses the default Discord avatar');
    if (isNewAccount) reasons.push(`Account is only ${Math.max(0, Math.floor(accountAge / 86_400_000))} day(s) old`);

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`alt_approve:${member.guild.id}:${member.id}`)
        .setLabel('Give Censored Role')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`alt_dismiss:${member.guild.id}:${member.id}`)
        .setLabel('Dismiss')
        .setStyle(ButtonStyle.Secondary)
    );

    await sendChannelLog(client, 'POTENTIAL_ALT_LOG_CHANNEL_ID', {
      title: 'Potential Alt Account',
      description: `${member} triggered the potential-alt checks.`,
      color: 0xFEE75C,
      thumbnail: member.user.displayAvatarURL({ size: 256 }),
      fields: [
        { name: 'User', value: `${member.user.tag}\n\`${member.id}\``, inline: true },
        { name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>\n<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Reasons', value: reasons.map((reason) => `• ${reason}`).join('\n'), inline: false },
      ],
      components: [buttons],
      content: `<@${member.id}>`,
      allowedMentions: { users: [member.id] },
    });
  },
};
