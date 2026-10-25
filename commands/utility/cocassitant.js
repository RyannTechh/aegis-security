const {
  SlashCommandBuilder,
  MessageFlags,
} = require('discord.js');

const {
  isOwner,
} = require('../../utils/checks');

const {
  addAssistant,
  isConfiguredManagementUser,
} = require('../../services/cocService');

const {
  successEmbed,
  errorEmbed,
} = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cocassitant')
    .setDescription(
      'Add an assistant to a configured chain-of-command member.'
    )
    .addUserOption((option) =>
      option
        .setName('management_user')
        .setDescription('Configured management member')
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName('assistant_user')
        .setDescription('User to add as an assistant')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Owner only',
            'Only a configured bot owner can add chain-of-command assistants.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const managementUser = interaction.options.getUser(
      'management_user',
      true
    );

    const assistantUser = interaction.options.getUser(
      'assistant_user',
      true
    );

    if (managementUser.id === assistantUser.id) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Invalid assistant',
            'A management member cannot be their own assistant.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const configured = isConfiguredManagementUser(
      interaction.guild.id,
      managementUser.id
    );

    if (!configured) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Management user not configured',
            `${managementUser} is not currently assigned to a chain-of-command rank.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    addAssistant(
      interaction.guild.id,
      managementUser.id,
      assistantUser.id,
      interaction.user.id
    );

    return interaction.reply({
      embeds: [
        successEmbed(
          'Assistant added',
          `${assistantUser} is now listed as an assistant to ${managementUser}.`
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
