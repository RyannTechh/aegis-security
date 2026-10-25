const {
  SlashCommandBuilder,
  MessageFlags,
  EmbedBuilder,
} = require('discord.js');

const db = require('../../database/database');
const { isOwner } = require('../../utils/checks');

const {
  successEmbed,
  errorEmbed,
  infoEmbed,
} = require('../../utils/embeds');

const PROTECTED_INVITE_GUILD_ID = '1415110755057139875';
const MASTER_LOG_CHANNEL_ID = '1496063082248536094';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Send one-time 30-minute server invites.')

    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('DM a one-time invite to a selected user')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('User who should receive the invite')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('server')
            .setDescription('Choose a configured server')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName('configure')
        .setDescription('Configure an invite destination. Owner only')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Short server name')
            .setRequired(true)
            .setMaxLength(30)
        )
        .addStringOption((option) =>
          option
            .setName('guild_id')
            .setDescription('Discord server ID')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('channel_id')
            .setDescription('Channel used to create the invite')
            .setRequired(true)
        )
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('Remove an invite destination. Owner only')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Configured server name')
            .setRequired(true)
            .setMaxLength(30)
        )
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('List configured invite destinations')
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options
      .getFocused()
      .trim()
      .toLowerCase();

    const rows = db.prepare(`
      SELECT name, guild_id
      FROM invite_servers
      ORDER BY name ASC
      LIMIT 100
    `).all();

    const choices = rows
      .filter((row) =>
        row.name.toLowerCase().includes(focusedValue)
      )
      .slice(0, 25)
      .map((row) => ({
        name: row.name,
        value: row.name,
      }));

    await interaction.respond(choices);
  },

  async execute(interaction, client) {
    await interaction.deferReply({
      flags: MessageFlags.Ephemeral,
    });

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'configure') {
      if (!isOwner(interaction.user.id)) {
        return interaction.editReply({
          embeds: [
            errorEmbed(
              'Owner only',
              'Only configured bot owners can configure invite destinations.'
            ),
          ],
        });
      }

      const name = interaction.options
        .getString('name', true)
        .trim()
        .toLowerCase();

      const guildId = interaction.options
        .getString('guild_id', true)
        .trim();

      const channelId = interaction.options
        .getString('channel_id', true)
        .trim();

      if (!/^\d{17,20}$/.test(guildId)) {
        return interaction.editReply({
          embeds: [
            errorEmbed(
              'Invalid server ID',
              'Enter a valid Discord server ID.'
            ),
          ],
        });
      }

      if (!/^\d{17,20}$/.test(channelId)) {
        return interaction.editReply({
          embeds: [
            errorEmbed(
              'Invalid channel ID',
              'Enter a valid Discord channel ID.'
            ),
          ],
        });
      }

      if (guildId === PROTECTED_INVITE_GUILD_ID) {
        return interaction.editReply({
          embeds: [
            errorEmbed(
              'Invites disabled for this server',
              'This server is permanently excluded from the bot invite system.'
            ),
          ],
        });
      }

      const guild =
        client.guilds.cache.get(guildId)
        || await client.guilds.fetch(guildId).catch(() => null);

      if (!guild) {
        return interaction.editReply({
          embeds: [
            errorEmbed(
              'Server unavailable',
              'The bot is not inside that server.'
            ),
          ],
        });
      }

      const channel =
        client.channels.cache.get(channelId)
        || await client.channels.fetch(channelId).catch(() => null);

      if (!channel || channel.guildId !== guildId) {
        return interaction.editReply({
          embeds: [
            errorEmbed(
              'Invalid channel',
              'That channel does not exist in the configured server.'
            ),
          ],
        });
      }

      if (typeof channel.createInvite !== 'function') {
        return interaction.editReply({
          embeds: [
            errorEmbed(
              'Unsupported channel',
              'That channel cannot be used to create invites.'
            ),
          ],
        });
      }

      db.prepare(`
        INSERT OR REPLACE INTO invite_servers
        (name, guild_id, channel_id)
        VALUES (?, ?, ?)
      `).run(
        name,
        guildId,
        channelId
      );

      return interaction.editReply({
        embeds: [
          successEmbed(
            'Invite destination saved',
            `Saved **${name}** for **${guild.name}** using <#${channelId}>.`
          ),
        ],
      });
    }

    if (subcommand === 'remove') {
      if (!isOwner(interaction.user.id)) {
        return interaction.editReply({
          embeds: [
            errorEmbed(
              'Owner only',
              'Only configured bot owners can remove invite destinations.'
            ),
          ],
        });
      }

      const name = interaction.options
        .getString('name', true)
        .trim()
        .toLowerCase();

      const changes = db.prepare(`
        DELETE FROM invite_servers
        WHERE name = ?
      `).run(name).changes;

      return interaction.editReply({
        embeds: [
          successEmbed(
            'Invite destination removed',
            changes
              ? `Removed **${name}**.`
              : `No destination named **${name}** was found.`
          ),
        ],
      });
    }

    if (subcommand === 'list') {
      const rows = db.prepare(`
        SELECT name, guild_id, channel_id
        FROM invite_servers
        ORDER BY name ASC
      `).all();

      const text = rows.length
        ? rows
            .map((row) =>
              `• **${row.name}** — Server: \`${row.guild_id}\` — Channel: <#${row.channel_id}>`
            )
            .join('\n')
        : 'No invite destinations are configured.';

      return interaction.editReply({
        embeds: [
          infoEmbed(
            'Invite destinations',
            text
          ),
        ],
      });
    }

    const targetUser = interaction.options.getUser('user', true);

    const serverName = interaction.options
      .getString('server', true)
      .trim()
      .toLowerCase();

    if (targetUser.bot) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Invalid recipient',
            'Invites cannot be sent to bot accounts.'
          ),
        ],
      });
    }

    const destination = db.prepare(`
      SELECT name, guild_id, channel_id
      FROM invite_servers
      WHERE name = ?
    `).get(serverName);

    if (!destination) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Unknown server',
            'That server is not configured. Use `/invite list` to see the exact configured names.'
          ),
        ],
      });
    }

    if (destination.guild_id === PROTECTED_INVITE_GUILD_ID) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Invites disabled for this server',
            'This server is permanently excluded from the bot invite system.'
          ),
        ],
      });
    }

    const destinationGuild =
      client.guilds.cache.get(destination.guild_id)
      || await client.guilds.fetch(destination.guild_id).catch(() => null);

    if (!destinationGuild) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Server unavailable',
            'The bot is no longer inside the configured destination server.'
          ),
        ],
      });
    }

    const inviteChannel =
      client.channels.cache.get(destination.channel_id)
      || await client.channels.fetch(destination.channel_id).catch(() => null);

    if (!inviteChannel) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Channel unavailable',
            'The configured invite channel no longer exists or the bot cannot access it.'
          ),
        ],
      });
    }

    if (typeof inviteChannel.createInvite !== 'function') {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Invite unavailable',
            'The configured channel cannot create Discord invites.'
          ),
        ],
      });
    }

    const invite = await inviteChannel.createInvite({
      maxAge: 1800,
      maxUses: 1,
      unique: true,
      reason:
        `One-time invite for ${targetUser.tag} `
        + `requested by ${interaction.user.tag}`,
    });

    const dmEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`You have been invited to ${destinationGuild.name}`)
      .setDescription(
        `You received a private one-time invite from ${interaction.user}.\n\n`
        + `This invite can only be used **once** and expires in **30 minutes**.`
      )
      .addFields(
        {
          name: 'Server',
          value: destinationGuild.name,
          inline: true,
        },
        {
          name: 'Sent by',
          value: interaction.user.tag,
          inline: true,
        }
      )
      .setTimestamp();

    const dmSent = await targetUser.send({
      content: invite.url,
      embeds: [dmEmbed],
    }).then(() => true).catch(() => false);

    if (!dmSent) {
      await invite.delete('Recipient DMs are closed').catch(() => null);

      return interaction.editReply({
        embeds: [
          errorEmbed(
            'DM failed',
            `${targetUser} has DMs disabled. The generated invite was deleted.`
          ),
        ],
      });
    }

    const inviteLogChannelId = '1533607023218786404';

    const inviteLogChannel =
      client.channels.cache.get(inviteLogChannelId)
      || await client.channels.fetch(inviteLogChannelId).catch(() => null);

    if (inviteLogChannel?.isTextBased()) {
      const inviteLogEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Invite Sent')
        .setDescription(
          `A one-time invite was successfully sent to ${targetUser}.`
        )
        .addFields(
          {
            name: 'Staff Member',
            value: `${interaction.user}\n\`${interaction.user.id}\``,
            inline: true,
          },
          {
            name: 'Recipient',
            value: `${targetUser}\n\`${targetUser.id}\``,
            inline: true,
          },
          {
            name: 'Server',
            value: `${destinationGuild.name}\n\`${destinationGuild.id}\``,
            inline: false,
          },
          {
            name: 'Invite Channel',
            value: `${inviteChannel}\n\`${inviteChannel.id}\``,
            inline: true,
          },
          {
            name: 'Invite Code',
            value: `\`${invite.code}\``,
            inline: true,
          },
          {
            name: 'Invite Link',
            value: `||${invite.url}||`,
            inline: false,
          },
          {
            name: 'Expires',
            value: '30 minutes',
            inline: true,
          },
          {
            name: 'Maximum Uses',
            value: '1',
            inline: true,
          },
          {
            name: 'DM Status',
            value: 'Successfully delivered',
            inline: true,
          }
        )
        .setTimestamp();

      await inviteLogChannel.send({
        embeds: [inviteLogEmbed],
      }).catch((error) => {
        console.error('Failed to send invite log:', error);
      });
    }

    const masterLogChannel =
      client.channels.cache.get(MASTER_LOG_CHANNEL_ID)
      || await client.channels.fetch(MASTER_LOG_CHANNEL_ID).catch(() => null);

    if (masterLogChannel?.isTextBased()) {
      const masterInviteEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('MASTER LOG • Invite Sent')
        .addFields(
          {
            name: 'Command User',
            value: `${interaction.user}\n\`${interaction.user.id}\``,
            inline: true,
          },
          {
            name: 'Recipient',
            value: `${targetUser}\n\`${targetUser.id}\``,
            inline: true,
          },
          {
            name: 'Destination Server',
            value: `${destinationGuild.name}\n\`${destinationGuild.id}\``,
            inline: false,
          },
          {
            name: 'Invite Channel',
            value: `<#${inviteChannel.id}>\n\`${inviteChannel.id}\``,
            inline: true,
          },
          {
            name: 'Invite Code',
            value: `\`${invite.code}\``,
            inline: true,
          }
        )
        .setTimestamp();

      await masterLogChannel.send({ embeds: [masterInviteEmbed] }).catch(() => null);
    }

    return interaction.editReply({
      embeds: [
        successEmbed(
          'Invite sent',
          `A one-time invite for **${destinationGuild.name}** was sent to ${targetUser}.\n`
          + `It expires in **30 minutes** and can only be used **once**.`
        ),
      ],
    });
  },
};
