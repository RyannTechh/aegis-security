const {
  SlashCommandBuilder,
  MessageFlags,
} = require('discord.js');

const {
  isOwner,
} = require('../../utils/checks');

const {
  COC_RANKS,
  addRankMember,
  getRank,
} = require('../../services/cocService');

const {
  successEmbed,
  errorEmbed,
} = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cocedit')
    .setDescription('Add a user to a chain-of-command rank.')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('User to add to the selected rank')
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
            'Only a configured bot owner can edit the chain of command.'
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

    const result = addRankMember(
      interaction.guild.id,
      rankKey,
      user.id,
      interaction.user.id
    );

    if (result.reason === 'already_assigned') {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Already assigned',
            `${user} is already assigned to **${rank.name}** with callsign **${result.callsign}**.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (result.reason === 'rank_full') {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Rank full',
            `**${rank.name}** already has the maximum of **${rank.callsigns.length}** members.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.reply({
      embeds: [
        successEmbed(
          'Chain of command updated',
          `${user} was added to **${rank.name}** with callsign **${result.callsign}**.`
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
