const {
  SlashCommandBuilder,
  MessageFlags,
  PermissionsBitField,
} = require('discord.js');

const {
  isOwner,
} = require('../../utils/checks');

const {
  successEmbed,
  errorEmbed,
} = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('globalnick')
    .setDescription('Set a nickname in every server shared with the bot.')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('User to rename; leave empty to rename yourself')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('nickname')
        .setDescription('New nickname; leave empty to reset it')
        .setRequired(false)
        .setMaxLength(32)
    ),

  async execute(interaction, client) {
    const selectedUser = interaction.options.getUser('user');
    const targetUser = selectedUser || interaction.user;

    if (
      targetUser.id !== interaction.user.id
      && !isOwner(interaction.user.id)
    ) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Owner only',
            'Only a configured bot owner can globally change another user’s nickname.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (targetUser.bot) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Invalid target',
            'This command cannot change the nickname of a bot account.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const nicknameOption = interaction.options.getString('nickname');
    const nickname =
      typeof nicknameOption === 'string'
        ? nicknameOption.trim()
        : null;

    if (nicknameOption !== null && nickname.length === 0) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Invalid nickname',
            'Enter a nickname or leave the option completely empty to reset it.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({
      flags: MessageFlags.Ephemeral,
    });

    let successful = 0;
    let skipped = 0;
    const failures = [];

    for (const guild of client.guilds.cache.values()) {
      try {
        const botMember =
          guild.members.me
          || await guild.members.fetchMe().catch(() => null);

        if (!botMember) {
          failures.push(
            `• **${guild.name}** — Bot member could not be fetched`
          );
          continue;
        }

        if (
          !botMember.permissions.has(
            PermissionsBitField.Flags.ManageNicknames
          )
        ) {
          failures.push(
            `• **${guild.name}** — Missing Manage Nicknames permission`
          );
          continue;
        }

        const member = await guild.members
          .fetch(targetUser.id)
          .catch(() => null);

        if (!member) {
          skipped++;
          continue;
        }

        if (member.id === guild.ownerId) {
          failures.push(
            `• **${guild.name}** — Bots cannot change the server owner's nickname`
          );
          continue;
        }

        if (
          member.roles.highest.position >= botMember.roles.highest.position
        ) {
          failures.push(
            `• **${guild.name}** — Target's highest role is equal to or above the bot's highest role`
          );
          continue;
        }

        if (member.nickname === nickname) {
          skipped++;
          continue;
        }

        await member.setNickname(
          nickname || null,
          `Global nickname command used by ${interaction.user.tag}`
        );

        successful++;
      } catch (error) {
        failures.push(
          `• **${guild.name}** — ${error?.message || 'Unknown error'}`
        );
      }
    }

    let description =
      `Target: ${targetUser} (\`${targetUser.id}\`)\n`
      + `Nickname: **${nickname || 'Reset to username'}**\n`
      + `Successful: **${successful}**\n`
      + `Skipped: **${skipped}**\n`
      + `Failed: **${failures.length}**`;

    if (failures.length) {
      description +=
        `\n\n**Failures**\n${failures.slice(0, 10).join('\n')}`;
    }

    if (failures.length > 10) {
      description +=
        `\n• Plus ${failures.length - 10} more failure(s).`;
    }

    return interaction.editReply({
      embeds: [
        successEmbed(
          nickname
            ? 'Global nickname finished'
            : 'Global nickname reset finished',
          description
        ),
      ],
    });
  },
};
