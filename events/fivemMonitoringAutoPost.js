const {
  Events,
} = require('discord.js');

const {
  ensureMonitoringPost,
} = require('../commands/utility/fivemstatus');

module.exports = {
  name: Events.ClientReady,

  async execute(client) {
    try {
      await ensureMonitoringPost(client);
    } catch (error) {
      console.error(
        '[FIVEM MONITORING] Startup failed:',
        error
      );
    }
  },
};
