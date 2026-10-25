const { Events, ActivityType } = require('discord.js');
const { startTemporaryRoleWorker } = require('../services/temporaryRoleService');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setActivity('over protected servers', { type: ActivityType.Watching });
    startTemporaryRoleWorker(client);
  },
};
