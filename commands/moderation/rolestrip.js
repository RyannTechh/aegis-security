const {
  SlashCommandBuilder,
  MessageFlags,
} = require('discord.js');

const {
  isOwner,
} = require('../../utils/checks');

const {
  successEmbed,
  errorEmbed,
} = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rolestrip')
    .setDescription('Remove all removable roles from a user.')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user to remove all roles from')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Reason for stripping the user roles')
        .setRequired(false)
        .setMaxLength(500)
    ),

  async execute(interaction) {
    /*
     * Owner-only, consistent with the bot's high-impact security commands.
     */
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Owner only',
            'Only a configured bot owner can use `/rolestrip`.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!interaction.guild) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Server only',
            'This command can only be used inside a server.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const targetUser =
      interaction.options.getUser('user', true);

    const reason =
      interaction.options.getString('reason')
      || `Role strip by ${interaction.user.tag} (${interaction.user.id})`;

    await interaction.deferReply({
      flags: MessageFlags.Ephemeral,
    });

    const member = await interaction.guild.members
      .fetch(targetUser.id)
      .catch(() => null);

    if (!member) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'User not found',
            'That user is not currently a member of this server.'
          ),
        ],
      });
    }

    if (member.id === interaction.guild.ownerId) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Cannot role-strip server owner',
            'Discord does not allow the server owner to be fully role-stripped by the bot.'
          ),
        ],
      });
    }

    const removableRoles = member.roles.cache.filter(
      (role) =>
        role.id !== interaction.guild.id
        && !role.managed
        && role.editable
    );

    const protectedRoles = member.roles.cache.filter(
      (role) =>
        role.id !== interaction.guild.id
        && (
          role.managed
          || !role.editable
        )
    );

    if (removableRoles.size === 0) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'No removable roles',
            `${member} does not have any roles the bot can remove.`
          ),
        ],
      });
    }

    try {
      /*
       * Pass the entire collection at once so Discord receives one batched
       * role-removal request instead of removing roles one-by-one.
       */
      await member.roles.remove(
        removableRoles,
        reason
      );
    } catch (error) {
      console.error(
        `[ROLESTRIP] Failed to strip ${member.user.tag} (${member.id}):`,
        error
      );

      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Role strip failed',
            'The bot could not remove the user roles. Make sure the bot role is above the roles being removed and has **Manage Roles**.'
          ),
        ],
      });
    }

    return interaction.editReply({
      embeds: [
        successEmbed(
          'Roles stripped',
          `Removed **${removableRoles.size}** role(s) from ${member}.\n\n`
          + `Reason: ${reason}`
          + (
            protectedRoles.size > 0
              ? `\n\n**${protectedRoles.size}** managed or higher roles could not be removed.`
              : ''
          )
        ),
      ],
    });
  },
};
