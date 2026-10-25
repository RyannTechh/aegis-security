const { EmbedBuilder } = require('discord.js');
const { brandEmbed } = require('./branding');

function successEmbed(title, description) {
  return brandEmbed(
    new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle(title)
      .setDescription(description)
      .setTimestamp()
  );
}

function errorEmbed(title, description) {
  return brandEmbed(
    new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle(title)
      .setDescription(description)
      .setTimestamp()
  );
}

function infoEmbed(title, description) {
  return brandEmbed(
    new EmbedBuilder()
      .setColor(0xFF1493)
      .setTitle(title)
      .setDescription(description)
      .setTimestamp()
  );
}

module.exports = { successEmbed, errorEmbed, infoEmbed };
