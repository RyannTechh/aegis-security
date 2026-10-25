const {
  SlashCommandBuilder,
  MessageFlags,
} = require('discord.js');

const {
  isOwner,
} = require('../../utils/checks');

const {
  COC_RANKS,
  getRank,
  getRankMembers,
  removeRankMember,
} = require('../../services/cocService');

const {
  successEmbed,
  errorEmbed,
} = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cocremove')
    .setDescription('Remove a user from a chain-of-command rank.')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('User to remove from the selected rank')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('rank')
        .setDescription('Chain-of-command rank')
        .setRequired(true)
        .addChoices(
          ...COC_RANKS.map((rank) => ({
            name: rank.name,
            value: rank.key,
          }))
        )
    ),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Owner only',
            'Only a configured bot owner can remove chain-of-command members.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const user = interaction.options.getUser(
      'user',
      true
    );

    const rankKey = interaction.options.getString(
      'rank',
      true
    );

    const rank = getRank(rankKey);

    if (!rank) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Invalid rank',
            'The selected rank is not configured.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const rankMembers = getRankMembers(
      interaction.guild.id,
      rankKey
    );

    const isAssigned = rankMembers.some(
      (member) => member.user_id === user.id
    );

    if (!isAssigned) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'User not assigned',
            `${user} is not assigned to **${rank.name}**.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const removed = removeRankMember(
      interaction.guild.id,
      rankKey,
      user.id
    );

    return interaction.reply({
      embeds: [
        successEmbed(
          'Chain of command updated',
          removed
            ? `${user} was removed from **${rank.name}**. Any assistants attached to that user were also removed.`
            : `No chain-of-command entry was removed for ${user}.`
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
