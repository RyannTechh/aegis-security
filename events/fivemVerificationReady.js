const { Events } = require('discord.js');
const {
  startFiveMVerificationApi,
} = require('../services/fivemVerificationService');

module.exports = {
  name: Events.ClientReady,

  async execute(client) {
    startFiveMVerificationApi(client);
  },
};
