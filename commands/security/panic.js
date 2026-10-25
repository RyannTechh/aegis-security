const {
  SlashCommandBuilder,
  MessageFlags,
} = require('discord.js');

const {
  isOwner,
  parseIds,
} = require('../../utils/checks');

const {
  getPanicState,
  activatePanic,
  restorePanic,
} = require('../../services/panicService');

const {
  sendSecurityAlert,
} = require('../../services/securityAlertService');

const {
  successEmbed,
  errorEmbed,
  infoEmbed,
} = require('../../utils/embeds');

const PANIC_DM_COUNT = 10;
const PANIC_DM_DELAY_MS = 650;

/*
 * Always receives panic alerts even if this ID is not present in OWNER_IDS.
 * This does NOT automatically give the user owner command permissions.
 */
const EXTRA_PANIC_ALERT_USER_IDS = [
  '1537513971798642730',
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPanicAlertRecipients() {
  const ownerIds = parseIds(process.env.OWNER_IDS);

  return [
    ...new Set([
      ...ownerIds,
      ...EXTRA_PANIC_ALERT_USER_IDS,
    ]),
  ];
}

async function sendOwnerPanicAlerts(client, guild, activatedBy) {
  const recipientIds = getPanicAlertRecipients();

  for (const recipientId of recipientIds) {
    const recipient = await client.users
      .fetch(recipientId, { force: true })
      .catch((error) => {
        console.error(
          `[PANIC] Could not fetch panic alert recipient ${recipientId}:`,
          error
        );
        return null;
      });

    if (!recipient) {
      continue;
    }

    for (let i = 1; i <= PANIC_DM_COUNT; i++) {
      try {
        await recipient.send({
          content:
            `🚨 **SALRP PANIC MODE ACTIVATED** 🚨\n`
            + `Server: **${guild.name}** (\`${guild.id}\`)\n`
            + `Activated by: <@${activatedBy.id}> (\`${activatedBy.id}\`)\n`
            + `Alert: **${i}/${PANIC_DM_COUNT}**`,
          allowedMentions: {
            users: [activatedBy.id],
          },
        });
      } catch (error) {
        console.error(
          `[PANIC] DM failed for ${recipient.tag} (${recipientId}) `
          + `on alert ${i}/${PANIC_DM_COUNT}:`,
          error
        );

        /*
         * If Discord refuses the first DM because the recipient has DMs
         * closed / privacy settings block the bot, retrying 9 more times
         * will not help, so stop for this recipient.
         */
        break;
      }

      if (i < PANIC_DM_COUNT) {
        await sleep(PANIC_DM_DELAY_MS);
      }
    }
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panic')
    .setDescription('Emergency security lockdown controls.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('start')
        .setDescription('Remove dangerous permissions from manageable staff roles')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('restore')
        .setDescription('Restore role permissions saved before panic mode')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription('Check whether panic mode is active')
    ),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Owner only',
            'Only a configured bot owner can use emergency panic mode.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'status') {
      const state = getPanicState(interaction.guild.id);

      return interaction.reply({
        embeds: [
          infoEmbed(
            'Emergency Panic Status',
            state.active
              ? `🔴 **ACTIVE**\nStarted by: <@${state.started_by}>\nStarted: <t:${Math.floor(state.started_at / 1000)}:F>`
              : '🟢 **INACTIVE**'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({
      flags: MessageFlags.Ephemeral,
    });

    if (subcommand === 'start') {
      const result = await activatePanic(
        interaction.guild,
        interaction.user.id
      );

      if (result.alreadyActive) {
        return interaction.editReply({
          embeds: [
            errorEmbed(
              'Panic already active',
              'Emergency panic mode is already active in this server.'
            ),
          ],
        });
      }

      await sendSecurityAlert(interaction.client, {
        title: 'SECURITY • Emergency Panic Activated',
        description:
          'Emergency panic mode was activated and dangerous permissions were removed from manageable roles.',
        fields: [
          {
            name: 'Activated By',
            value: `${interaction.user}\n\`${interaction.user.id}\``,
          },
          {
            name: 'Server',
            value: `${interaction.guild.name}\n\`${interaction.guild.id}\``,
          },
          {
            name: 'Roles Modified',
            value: String(result.changed),
            inline: true,
          },
          {
            name: 'Failures',
            value: String(result.failed.length),
            inline: true,
          },
        ],
        color: 0xED4245,
      });

      await sendOwnerPanicAlerts(
        interaction.client,
        interaction.guild,
        interaction.user
      );

      return interaction.editReply({
        embeds: [
          successEmbed(
            'Emergency panic activated',
            `Dangerous permissions were removed from **${result.changed}** manageable role(s).\n`
            + `Failed: **${result.failed.length}**\n\n`
            + `Panic DM alerts were sent to all configured alert recipients.\n\n`
            + 'Use `/panic restore` when the emergency is over.'
          ),
        ],
      });
    }

    const result = await restorePanic(
      interaction.guild,
      interaction.user.id
    );

    if (result.notActive) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Panic is not active',
            'There is no active panic-mode backup to restore.'
          ),
        ],
      });
    }

    await sendSecurityAlert(interaction.client, {
      title: 'SECURITY • Emergency Panic Restored',
      description:
        'Emergency panic mode was disabled and saved role permissions were restored.',
      fields: [
        {
          name: 'Restored By',
          value: `${interaction.user}\n\`${interaction.user.id}\``,
        },
        {
          name: 'Server',
          value: `${interaction.guild.name}\n\`${interaction.guild.id}\``,
        },
        {
          name: 'Roles Restored',
          value: String(result.restored),
          inline: true,
        },
        {
          name: 'Skipped',
          value: String(result.skipped),
          inline: true,
        },
        {
          name: 'Failures',
          value: String(result.failed.length),
          inline: true,
        },
      ],
      color: 0x57F287,
    });

    return interaction.editReply({
      embeds: [
        successEmbed(
          'Emergency panic restored',
          `Restored: **${result.restored}**\n`
          + `Skipped: **${result.skipped}**\n`
          + `Failed: **${result.failed.length}**`
        ),
      ],
    });
  },
};
