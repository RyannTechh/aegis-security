const {
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const {
  APPROVAL_GUILD_ID,
  APPROVAL_CHANNEL_ID,
  createPendingApproval,
  attachApprovalMessage,
} = require('../services/guildApprovalService');

module.exports = {
  name: Events.GuildCreate,

  async execute(client, guild) {
    /*
     * Never require approval for the dedicated approval/control server itself.
     */
    if (guild.id === APPROVAL_GUILD_ID) {
      return;
    }

    createPendingApproval(guild);

    const approvalGuild =
      client.guilds.cache.get(APPROVAL_GUILD_ID)
      || await client.guilds.fetch(APPROVAL_GUILD_ID).catch(() => null);

    if (!approvalGuild) {
      console.error(
        `[GUILD APPROVAL] Approval server ${APPROVAL_GUILD_ID} is unavailable.`
      );
      return;
    }

    const approvalChannel =
      approvalGuild.channels.cache.get(APPROVAL_CHANNEL_ID)
      || await approvalGuild.channels.fetch(APPROVAL_CHANNEL_ID).catch(() => null);

    if (!approvalChannel?.isTextBased()) {
      console.error(
        `[GUILD APPROVAL] Approval channel ${APPROVAL_CHANNEL_ID} is unavailable.`
      );
      return;
    }

    const owner = await guild.fetchOwner().catch(() => null);

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('New Server Approval Required')
      .setDescription(
        'The bot has joined a new Discord server.\n\n'
        + '**Approve** to allow the bot to remain.\n'
        + '**Deny** to make the bot immediately leave the server.'
      )
      .addFields(
        {
          name: 'Server',
          value: `${guild.name}\n\`${guild.id}\``,
          inline: false,
        },
        {
          name: 'Server Owner',
          value: owner
            ? `${owner.user}\n\`${owner.id}\``
            : guild.ownerId
              ? `<@${guild.ownerId}>\n\`${guild.ownerId}\``
              : 'Unknown',
          inline: true,
        },
        {
          name: 'Members',
          value: String(guild.memberCount || 0),
          inline: true,
        },
        {
          name: 'Joined',
          value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: false,
        }
      )
      .setFooter({
        text: 'SALRP • Guild Approval System',
      })
      .setTimestamp();

    if (guild.iconURL()) {
      embed.setThumbnail(
        guild.iconURL({
          extension: 'png',
          size: 256,
        })
      );
    }

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`guildapproval:approve:${guild.id}`)
        .setLabel('Approve Server')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`guildapproval:deny:${guild.id}`)
        .setLabel('Deny & Leave')
        .setStyle(ButtonStyle.Danger)
    );

    const message = await approvalChannel.send({
      embeds: [embed],
      components: [buttons],
    }).catch((error) => {
      console.error('[GUILD APPROVAL] Failed to send approval request:', error);
      return null;
    });

    if (message) {
      attachApprovalMessage(
        guild.id,
        message.id
      );
    }
  },
};
