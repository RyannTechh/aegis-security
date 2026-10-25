const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');

const {
  isOwner,
} = require('../../utils/checks');

const {
  COC_RANKS,
  getAllRankMembers,
  getAssistants,
} = require('../../services/cocService');

const {
  errorEmbed,
} = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('coc')
    .setDescription('Send the complete San Andreas Life Roleplay chain of command.'),

  async execute(interaction) {
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

    await interaction.deferReply();

    const configuredMembers = getAllRankMembers(
      interaction.guild.id
    );

    const embeds = [];

    for (const rank of COC_RANKS) {
      const rankMembers = configuredMembers.get(rank.key) || [];

      let description = 'No members assigned to this rank.';

      if (rankMembers.length > 0) {
        const memberSections = rankMembers.map((configured) => {
          const assistants = getAssistants(
            interaction.guild.id,
            configured.user_id
          );

          const assistantText = assistants.length > 0
            ? assistants
                .map((assistant) => `<@${assistant.assistant_user_id}>`)
                .join(', ')
            : 'None';

          return [
            `**${configured.callsign || 'Unassigned'}**`,
            `<@${configured.user_id}>`,
            `**Assistant(s):** ${assistantText}`,
          ].join('\n');
        });

        description = memberSections.join('\n\n');
      }

      const embed = new EmbedBuilder()
        .setColor(rank.color)
        .setTitle(rank.name)
        .setDescription(description)
        .setFooter({
          text: 'San Andreas Life Roleplay • Chain of Command',
          iconURL:
            interaction.guild.iconURL({
              size: 128,
              extension: 'png',
            }) || undefined,
        });

      embeds.push(embed);
    }

    return interaction.editReply({
      content: '**San Andreas Life Roleplay Chain of Command**',
      embeds,
      allowedMentions: {
        parse: [],
      },
    });
  },
};
