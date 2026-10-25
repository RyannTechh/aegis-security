const {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');

const {
  isOwner,
} = require('../../utils/checks');

const {
  getEmojiKey,
  getEmojiDisplay,
  saveReactionRole,
  removeReactionRole,
  listReactionRoles,
  removeReactionRolesForMessage,
} = require('../../services/reactionRoleService');

const {
  successEmbed,
  errorEmbed,
  infoEmbed,
} = require('../../utils/embeds');

function canManageReactionRoles(interaction) {
  return (
    isOwner(interaction.user.id)
    || interaction.member.permissions.has(
      PermissionFlagsBits.ManageRoles
    )
  );
}

async function resolveMessage(interaction, channel, messageId) {
  if (!/^\d{17,20}$/.test(messageId)) {
    return null;
  }

  return channel.messages.fetch(messageId).catch(() => null);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Set up and manage reaction roles.')

    .addSubcommand((subcommand) =>
      subcommand
        .setName('setup')
        .setDescription('Create or update a reaction role')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Channel containing the message')
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildAnnouncement
            )
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('message_id')
            .setDescription('ID of the message')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('emoji')
            .setDescription('Unicode emoji or custom server emoji')
            .setRequired(true)
            .setMaxLength(100)
        )
        .addRoleOption((option) =>
          option
            .setName('role')
            .setDescription('Role given by the reaction')
            .setRequired(true)
        )
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('Remove one reaction-role association')
        .addStringOption((option) =>
          option
            .setName('message_id')
            .setDescription('ID of the reaction-role message')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('emoji')
            .setDescription('Emoji association to remove')
            .setRequired(true)
            .setMaxLength(100)
        )
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName('removeall')
        .setDescription('Remove all reaction roles from one message')
        .addStringOption((option) =>
          option
            .setName('message_id')
            .setDescription('ID of the reaction-role message')
            .setRequired(true)
        )
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('List saved reaction roles')
    ),

  async execute(interaction) {
    if (!canManageReactionRoles(interaction)) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'No permission',
            'You need the Manage Roles permission to manage reaction roles.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'list') {
      const rows = listReactionRoles(interaction.guild.id);

      const description = rows.length
        ? rows
            .slice(0, 25)
            .map((row, index) =>
              `${index + 1}. ${row.emoji_display} → <@&${row.role_id}>\n`
              + `Message: [Open](https://discord.com/channels/${row.guild_id}/${row.channel_id}/${row.message_id})`
            )
            .join('\n\n')
        : 'No reaction roles are configured in this server.';

      return interaction.reply({
        embeds: [
          infoEmbed(
            'Saved Reaction Roles',
            description
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (subcommand === 'removeall') {
      const messageId = interaction.options.getString(
        'message_id',
        true
      );

      const removed = removeReactionRolesForMessage(
        interaction.guild.id,
        messageId
      );

      return interaction.reply({
        embeds: [
          successEmbed(
            'Reaction roles removed',
            `Removed **${removed}** saved reaction-role association(s) from message \`${messageId}\`.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const messageId = interaction.options.getString(
      'message_id',
      true
    );

    const emojiInput = interaction.options
      .getString('emoji', true)
      .trim();

    const emojiKey = getEmojiKey(emojiInput);

    if (!emojiKey) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Invalid emoji',
            'Enter a valid Unicode emoji or custom server emoji.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (subcommand === 'remove') {
      const removed = removeReactionRole(
        interaction.guild.id,
        messageId,
        emojiKey
      );

      return interaction.reply({
        embeds: [
          successEmbed(
            'Reaction role removed',
            removed
              ? `Removed the ${emojiInput} association from message \`${messageId}\`.`
              : 'No matching reaction role was found.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({
      flags: MessageFlags.Ephemeral,
    });

    const channel = interaction.options.getChannel(
      'channel',
      true
    );

    const role = interaction.options.getRole(
      'role',
      true
    );

    if (role.id === interaction.guild.id) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Invalid role',
            'The everyone role cannot be used as a reaction role.'
          ),
        ],
      });
    }

    if (role.managed || !role.editable) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Role cannot be managed',
            'Move the bot role above this role and make sure it is not an integration-managed role.'
          ),
        ],
      });
    }

    const message = await resolveMessage(
      interaction,
      channel,
      messageId
    );

    if (!message) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Message not found',
            'The message ID is invalid, the message is in another channel, or the bot cannot access it.'
          ),
        ],
      });
    }

    let reaction;

    try {
      reaction = await message.react(emojiInput);
    } catch (error) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Emoji failed',
            'The bot could not react with that emoji. For custom emojis, make sure the bot can access the emoji.'
          ),
        ],
      });
    }

    const actualEmojiKey = getEmojiKey(reaction.emoji);
    const emojiDisplay = getEmojiDisplay(reaction.emoji);

    saveReactionRole({
      guildId: interaction.guild.id,
      channelId: channel.id,
      messageId: message.id,
      emojiKey: actualEmojiKey,
      emojiDisplay,
      roleId: role.id,
      createdBy: interaction.user.id,
    });

    return interaction.editReply({
      embeds: [
        successEmbed(
          'Reaction role saved',
          `${emojiDisplay} on [this message](${message.url}) will now give or remove ${role}.`
        ),
      ],
    });
  },
};
