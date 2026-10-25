const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');

const { isOwner } = require('../../utils/checks');

const PROTECTED_INVITE_GUILD_ID = '1415110755057139875';
const MASTER_LOG_CHANNEL_ID = '1496063082248536094';
const {
  successEmbed,
  errorEmbed,
} = require('../../utils/embeds');

function canCreateInvite(channel, botMember) {
  if (!channel || typeof channel.createInvite !== 'function') {
    return false;
  }

  const permissions = channel.permissionsFor(botMember);

  return Boolean(
    permissions?.has(PermissionFlagsBits.ViewChannel)
    && permissions?.has(PermissionFlagsBits.CreateInstantInvite)
  );
}

function findInviteChannel(guild) {
  const botMember = guild.members.me;

  const preferredChannels = [
    guild.systemChannel,
    guild.rulesChannel,
    guild.publicUpdatesChannel,
  ].filter(Boolean);

  for (const channel of preferredChannels) {
    if (canCreateInvite(channel, botMember)) {
      return channel;
    }
  }

  return guild.channels.cache
    .filter((channel) =>
      [
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
        ChannelType.GuildVoice,
        ChannelType.GuildStageVoice,
      ].includes(channel.type)
    )
    .sort((a, b) => a.rawPosition - b.rawPosition)
    .find((channel) => canCreateInvite(channel, botMember))
    || null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('globalinvite')
    .setDescription(
      'Send a selected user one-time invites to every server the bot is in.'
    )
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('User who should receive all server invites')
        .setRequired(true)
    ),

  async execute(interaction, client) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Owner only',
            'Only a configured bot owner can use this command.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const targetUser = interaction.options.getUser('user', true);

    if (targetUser.bot) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Invalid recipient',
            'Global invites cannot be sent to bot accounts.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({
      flags: MessageFlags.Ephemeral,
    });

    const dmAvailable = await targetUser.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF69B4)
          .setTitle('San Andreas Life Roleplay Invitations')
          .setDescription(
            `You are receiving one-time invitations to the San Andreas Life Roleplay servers from ${interaction.user}.\n\n`
            + 'Each invite can only be used **once** and expires after **30 minutes**.'
          )
          .setTimestamp(),
      ],
    }).then(() => true).catch(() => false);

    if (!dmAvailable) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'DM failed',
            `${targetUser} has DMs disabled. No invites were created.`
          ),
        ],
      });
    }

    let sent = 0;
    let failed = 0;
    const failures = [];

    for (const guild of client.guilds.cache.values()) {
      let invite = null;

      if (guild.id === PROTECTED_INVITE_GUILD_ID) {
        continue;
      }

      try {
        const inviteChannel = findInviteChannel(guild);

        if (!inviteChannel) {
          throw new Error(
            'No channel is available where the bot can create an invite.'
          );
        }

        invite = await inviteChannel.createInvite({
          maxAge: 1800,
          maxUses: 1,
          unique: true,
          reason:
            `Global one-time invite for ${targetUser.tag} `
            + `requested by ${interaction.user.tag}`,
        });

        const inviteEmbed = new EmbedBuilder()
          .setColor(0xFF69B4)
          .setTitle(guild.name)
          .setDescription(
            'Use the private invite below to join this server.\n\n'
            + 'This invite expires in **30 minutes** and can only be used **once**.'
          )
          .addFields({
            name: 'Invite',
            value: invite.url,
            inline: false,
          })
          .setFooter({
            text: 'San Andreas Life Roleplay',
          })
          .setTimestamp();

        const guildIcon = guild.iconURL({
          size: 256,
          extension: 'png',
        });

        if (guildIcon) {
          inviteEmbed.setThumbnail(guildIcon);
        }

        const delivered = await targetUser.send({
          embeds: [inviteEmbed],
        }).then(() => true).catch(() => false);

        if (!delivered) {
          await invite.delete(
            'Global invite DM delivery failed'
          ).catch(() => null);

          throw new Error('The invite DM could not be delivered.');
        }

        sent++;
      } catch (error) {
        failed++;
        failures.push(
          `• **${guild.name}** — ${error?.message || 'Unknown error'}`
        );
      }
    }

    let description =
      `Recipient: ${targetUser}\n`
      + `Invites sent: **${sent}**\n`
      + `Failed: **${failed}**`;

    if (failures.length > 0) {
      description +=
        `\n\n**Failures**\n${failures.slice(0, 10).join('\n')}`;

      if (failures.length > 10) {
        description +=
          `\n• Plus ${failures.length - 10} more failure(s).`;
      }
    }

    const masterLogChannel =
      client.channels.cache.get(MASTER_LOG_CHANNEL_ID)
      || await client.channels.fetch(MASTER_LOG_CHANNEL_ID).catch(() => null);

    if (masterLogChannel?.isTextBased()) {
      const masterEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('MASTER LOG • Global Invite')
        .addFields(
          {
            name: 'Executed By',
            value: `${interaction.user}\n\`${interaction.user.id}\``,
            inline: true,
          },
          {
            name: 'Recipient',
            value: `${targetUser}\n\`${targetUser.id}\``,
            inline: true,
          },
          {
            name: 'Invites Sent',
            value: String(sent),
            inline: true,
          },
          {
            name: 'Failed',
            value: String(failed),
            inline: true,
          },
          {
            name: 'Protected Server',
            value: `Skipped: \`${PROTECTED_INVITE_GUILD_ID}\``,
            inline: false,
          }
        )
        .setTimestamp();

      await masterLogChannel.send({ embeds: [masterEmbed] }).catch(() => null);
    }

    return interaction.editReply({
      embeds: [
        successEmbed(
          'Global invites processed',
          description
        ),
      ],
    });
  },
};
