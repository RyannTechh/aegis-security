const {
  SlashCommandBuilder,
  MessageFlags,
} = require('discord.js');

const { isOwner } = require('../../utils/checks');
const {
  getMaintenanceState,
  setMaintenance,
} = require('../../services/maintenanceService');

const {
  successEmbed,
  errorEmbed,
  infoEmbed,
} = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('maintenance')
    .setDescription('Manage global bot maintenance mode.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('on')
        .setDescription('Enable maintenance mode')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('off')
        .setDescription('Disable maintenance mode')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription('View maintenance mode status')
    ),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Owner only',
            'Only a configured bot owner can use maintenance controls.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'status') {
      const state = getMaintenanceState();

      return interaction.reply({
        embeds: [
          infoEmbed(
            'Maintenance Mode',
            state.enabled
              ? `🔴 **ENABLED**\nEnabled by: <@${state.enabled_by}>\nSince: <t:${Math.floor(state.enabled_at / 1000)}:F>`
              : '🟢 **DISABLED**'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (subcommand === 'on') {
      setMaintenance(true, interaction.user.id);

      return interaction.reply({
        embeds: [
          successEmbed(
            'Maintenance enabled',
            'All non-owner slash commands are now blocked globally.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    setMaintenance(false, interaction.user.id);

    return interaction.reply({
      embeds: [
        successEmbed(
          'Maintenance disabled',
          'Normal command access has been restored.'
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
