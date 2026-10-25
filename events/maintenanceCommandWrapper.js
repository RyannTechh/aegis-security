const {
  Events,
  MessageFlags,
} = require('discord.js');

const { isOwner } = require('../utils/checks');
const {
  getMaintenanceState,
} = require('../services/maintenanceService');

module.exports = {
  name: Events.ClientReady,

  async execute(client) {
    /*
     * Wrap every command execute() once.
     * This avoids needing to replace your existing interactionCreate handler
     * and therefore preserves your existing buttons/global-ban systems.
     */
    for (const command of client.commands.values()) {
      if (
        typeof command.execute !== 'function'
        || command.__maintenanceWrapped
      ) {
        continue;
      }

      const originalExecute = command.execute.bind(command);

      command.execute = async function wrappedExecute(
        interaction,
        ...args
      ) {
        const state = getMaintenanceState();

        if (
          state.enabled
          && !isOwner(interaction.user.id)
        ) {
          const payload = {
            content:
              '🔧 The bot is currently in maintenance mode. Please try again later.',
            flags: MessageFlags.Ephemeral,
          };

          if (interaction.deferred || interaction.replied) {
            return interaction.followUp(payload).catch(() => null);
          }

          return interaction.reply(payload).catch(() => null);
        }

        return originalExecute(
          interaction,
          ...args
        );
      };

      command.__maintenanceWrapped = true;
    }

    console.log(
      `[MAINTENANCE] Wrapped ${client.commands.size} command(s) with maintenance protection.`
    );
  },
};
