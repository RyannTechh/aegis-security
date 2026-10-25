const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');

const {
  normalizeIp,
  addIpBan,
  getDiscordIdsForIp,
  banDiscordIdForIp,
} = require('../../services/ipBanService');

const {
  successEmbed,
  errorEmbed,
} = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ipban')
    .setDescription('Ban an IP address from this server through the linked verification system.')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption((option) => option
      .setName('ip')
      .setDescription('IPv4 or IPv6 address to ban')
      .setRequired(true)
      .setMaxLength(64))
    .addStringOption((option) => option
      .setName('reason')
      .setDescription('Reason for the IP ban')
      .setRequired(false)
      .setMaxLength(500)),

  async execute(interaction) {
    const rawIp = interaction.options.getString('ip', true);
    const ip = normalizeIp(rawIp);
    const reason = interaction.options.getString('reason')
      || `IP banned by ${interaction.user.tag}`;

    if (!ip) {
      return interaction.reply({
        embeds: [errorEmbed('Invalid IP', 'Enter a valid IPv4 or IPv6 address.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    const banRecord = addIpBan(
      interaction.guild.id,
      ip,
      reason,
      interaction.user.id
    );

    const linkedDiscordIds = getDiscordIdsForIp(ip);
    let newlyBanned = 0;
    let alreadyBanned = 0;
    let failed = 0;

    for (const discordId of linkedDiscordIds) {
      const result = await banDiscordIdForIp(
        interaction.guild,
        discordId,
        banRecord
      );

      if (result.ok && result.alreadyBanned) alreadyBanned++;
      else if (result.ok) newlyBanned++;
      else failed++;
    }

    return interaction.reply({
      embeds: [successEmbed(
        'IP Banned',
        `\`${ip}\` has been added to this server's IP ban list.\n\n`
        + `**Reason:** ${reason}\n`
        + `**Linked accounts found:** ${linkedDiscordIds.length}\n`
        + `**New Discord bans:** ${newlyBanned}\n`
        + `**Already banned:** ${alreadyBanned}\n`
        + `**Failed:** ${failed}\n\n`
        + 'Future FiveM verification joins from this IP will also be blocked and the linked Discord account will be banned.'
      )],
      flags: MessageFlags.Ephemeral,
    });
  },
};
