const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
} = require('discord.js');

const db = require('../../database/database');
const {
  parseIds,
  isOwner,
} = require('../../utils/checks');

const {
  successEmbed,
  errorEmbed,
} = require('../../utils/embeds');

function hasOfficeManagerRole(member) {
  return parseIds(process.env.OFFICE_MANAGER_ROLE_IDS)
    .some((roleId) => member.roles.cache.has(roleId));
}

function canManageOffice(interaction, office) {
  return (
    office.owner_id === interaction.user.id
    || isOwner(interaction.user.id)
    || hasOfficeManagerRole(interaction.member)
    || interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)
  );
}

async function safeEditReply(interaction, payload) {
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(payload).catch(() => null);
  }

  return interaction.reply({
    ...payload,
    flags: MessageFlags.Ephemeral,
  }).catch(() => null);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('office')
    .setDescription('Manage private voice offices.')

    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Create an office')
        .addUserOption((option) =>
          option
            .setName('owner')
            .setDescription('Office owner')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Office name')
            .setRequired(true)
            .setMaxLength(50)
        )
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName('access')
        .setDescription('Give someone access to an office')
        .addChannelOption((option) =>
          option
            .setName('office')
            .setDescription('Office voice channel')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true)
        )
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('User to grant access')
            .setRequired(true)
        )
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName('edit')
        .setDescription('Rename an office')
        .addChannelOption((option) =>
          option
            .setName('office')
            .setDescription('Office voice channel')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('New office name')
            .setRequired(true)
            .setMaxLength(50)
        )
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName('delete')
        .setDescription('Delete an office')
        .addChannelOption((option) =>
          option
            .setName('office')
            .setDescription('Office voice channel')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    await interaction.deferReply({
      flags: MessageFlags.Ephemeral,
    });

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'create') {
      const allowed =
        isOwner(interaction.user.id)
        || hasOfficeManagerRole(interaction.member)
        || interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);

      if (!allowed) {
        return safeEditReply(interaction, {
          embeds: [
            errorEmbed(
              'No permission',
              'You are not allowed to create offices.'
            ),
          ],
        });
      }

      const owner = interaction.options.getMember('owner');
      const name = interaction.options.getString('name', true).trim();
      const categoryId = process.env.OFFICE_CATEGORY_ID;
      const category = interaction.guild.channels.cache.get(categoryId);

      if (!owner) {
        return safeEditReply(interaction, {
          embeds: [
            errorEmbed(
              'Member not found',
              'The selected user could not be found in this server.'
            ),
          ],
        });
      }

      if (!category || category.type !== ChannelType.GuildCategory) {
        return safeEditReply(interaction, {
          embeds: [
            errorEmbed(
              'Invalid configuration',
              'OFFICE_CATEGORY_ID is missing or does not point to a category.'
            ),
          ],
        });
      }

      const channel = await interaction.guild.channels.create({
        name,
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.Connect,
            ],
          },
          {
            id: owner.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.Speak,
            ],
          },
        ],
        reason: `Office created by ${interaction.user.tag}`,
      });

      db.prepare(`
        INSERT OR REPLACE INTO offices
        (guild_id, channel_id, owner_id, created_at)
        VALUES (?, ?, ?, ?)
      `).run(
        interaction.guild.id,
        channel.id,
        owner.id,
        Date.now()
      );

      return safeEditReply(interaction, {
        embeds: [
          successEmbed(
            'Office created',
            `${channel} was created for ${owner}.`
          ),
        ],
      });
    }

    const channel = interaction.options.getChannel('office', true);

    const office = db.prepare(`
      SELECT guild_id, channel_id, owner_id, created_at
      FROM offices
      WHERE guild_id = ? AND channel_id = ?
    `).get(
      interaction.guild.id,
      channel.id
    );

    if (!office) {
      return safeEditReply(interaction, {
        embeds: [
          errorEmbed(
            'Unknown office',
            'That channel is not registered as an office.'
          ),
        ],
      });
    }

    if (!canManageOffice(interaction, office)) {
      return safeEditReply(interaction, {
        embeds: [
          errorEmbed(
            'No permission',
            'Only the office owner, an office manager, or server management can do this.'
          ),
        ],
      });
    }

    if (subcommand === 'access') {
      const user = interaction.options.getUser('user', true);

      await channel.permissionOverwrites.edit(
        user.id,
        {
          ViewChannel: true,
          Connect: true,
          Speak: true,
        },
        {
          reason: `Office access granted by ${interaction.user.tag}`,
        }
      );

      db.prepare(`
        INSERT OR REPLACE INTO office_access
        (channel_id, user_id, created_at)
        VALUES (?, ?, ?)
      `).run(
        channel.id,
        user.id,
        Date.now()
      );

      return safeEditReply(interaction, {
        embeds: [
          successEmbed(
            'Office access granted',
            `${user} can now access ${channel}.`
          ),
        ],
      });
    }

    if (subcommand === 'edit') {
      const newName = interaction.options.getString('name', true).trim();

      await channel.setName(
        newName,
        `Office renamed by ${interaction.user.tag}`
      );

      return safeEditReply(interaction, {
        embeds: [
          successEmbed(
            'Office renamed',
            `The office is now named **${newName}**.`
          ),
        ],
      });
    }

    if (subcommand === 'delete') {
      const channelMention = `<#${channel.id}>`;

      db.prepare(`
        DELETE FROM office_access
        WHERE channel_id = ?
      `).run(channel.id);

      db.prepare(`
        DELETE FROM offices
        WHERE channel_id = ?
      `).run(channel.id);

      await channel.delete(
        `Office deleted by ${interaction.user.tag}`
      );

      return safeEditReply(interaction, {
        embeds: [
          successEmbed(
            'Office deleted',
            `${channelMention} was deleted.`
          ),
        ],
      });
    }
  },
};
