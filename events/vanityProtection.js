const {
  Events,
} = require('discord.js');

const {
  findVanityExecutor,
  isAuthorizedVanityExecutor,
  banVanityExecutor,
  restoreVanity,
} = require('../services/vanityProtectionService');

const {
  sendSecurityAlert,
} = require('../services/securityAlertService');

module.exports = {
  name: Events.GuildUpdate,

  async execute(client, oldGuild, newGuild) {
    const oldVanity = oldGuild.vanityURLCode || null;
    const newVanity = newGuild.vanityURLCode || null;

    if (oldVanity === newVanity) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1200));

    const entry = await findVanityExecutor(newGuild);
    const executorId = entry?.executorId || null;

    if (
      executorId
      && isAuthorizedVanityExecutor(newGuild, executorId)
    ) {
      await sendSecurityAlert(client, {
        title: 'SECURITY • Authorized Vanity Change',
        description:
          'The server vanity URL was changed by an authorized owner.',
        fields: [
          {
            name: 'Executor',
            value: `<@${executorId}>\n\`${executorId}\``,
          },
          {
            name: 'Old Vanity',
            value: oldVanity ? `\`${oldVanity}\`` : 'None',
            inline: true,
          },
          {
            name: 'New Vanity',
            value: newVanity ? `\`${newVanity}\`` : 'None',
            inline: true,
          },
          {
            name: 'Server',
            value: `${newGuild.name}\n\`${newGuild.id}\``,
          },
        ],
        color: 0x57F287,
      });

      return;
    }

    const restoreResult = await restoreVanity(
      newGuild,
      oldVanity
    );

    let banResult = {
      banned: false,
      reason: 'executor_not_found',
    };

    if (executorId) {
      banResult = await banVanityExecutor(
        newGuild,
        executorId
      ).catch((error) => ({
        banned: false,
        reason: error?.message || 'ban_failed',
      }));
    }

    await sendSecurityAlert(client, {
      title: 'SECURITY • Unauthorized Vanity Change',
      description:
        'An unauthorized vanity URL change was detected.',
      fields: [
        {
          name: 'Executor',
          value: executorId
            ? `<@${executorId}>\n\`${executorId}\``
            : 'Could not identify executor',
        },
        {
          name: 'Old Vanity',
          value: oldVanity ? `\`${oldVanity}\`` : 'None',
          inline: true,
        },
        {
          name: 'Attempted Vanity',
          value: newVanity ? `\`${newVanity}\`` : 'None',
          inline: true,
        },
        {
          name: 'Vanity Restored',
          value: restoreResult.restored
            ? 'Yes'
            : `No — \`${restoreResult.reason}\``,
          inline: false,
        },
        {
          name: 'Executor Banned',
          value: banResult.banned
            ? 'Yes'
            : `No — \`${banResult.reason}\``,
          inline: false,
        },
        {
          name: 'Server',
          value: `${newGuild.name}\n\`${newGuild.id}\``,
        },
      ],
      color: 0xED4245,
    });
  },
};
