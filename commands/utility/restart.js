const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { isOwner } = require('../../utils/checks');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
module.exports={data:new SlashCommandBuilder().setName('restart').setDescription('Restart the San Andreas Life Roleplay bot process.'),async execute(interaction){if(!isOwner(interaction.user.id))return interaction.reply({embeds:[errorEmbed('Owner only','Only a configured bot owner can restart the bot.')],flags:MessageFlags.Ephemeral});await interaction.reply({embeds:[successEmbed('Restarting San Andreas Life Roleplay','The bot process is shutting down now. Your process manager must be configured to automatically restart it.')],flags:MessageFlags.Ephemeral});setTimeout(()=>process.exit(0),1200);}};
