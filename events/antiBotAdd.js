const {
  Events,
  AuditLogEvent,
} = require('discord.js');

const {
  isProtectedFromAutomaticPunishment,
  roleStripMember,
} = require('../services/securityPunishmentService');

const {
  sendSecurityAlert,
} = require('../services/securityAlertService');

module.exports = {
  name: Events.GuildMemberAdd,

  async execute(client, member) {
    if (!member.user.bot) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1200));

    const logs = await member.guild.fetchAuditLogs({
      type: AuditLogEvent.BotAdd,
      limit: 8,
    }).catch(() => null);

    const entry = logs?.entries.find(
      (auditEntry) =>
        auditEntry.target?.id === member.id
        && Date.now() - auditEntry.createdTimestamp < 20000
    );

    const executorId = entry?.executorId;

    if (!executorId) {
      await sendSecurityAlert(client, {
        title: 'SECURITY • Bot Added',
        description:
          `${member.user.tag} was added, but the inviter could not be identified.`,
        fields: [
          {
            name: 'Bot',
            value: `${member.user}\n\`${member.id}\``,
          },
          {
            name: 'Server',
            value: `${member.guild.name}\n\`${member.guild.id}\``,
          },
        ],
        color: 0xFEE75C,
      });

      return;
    }

    if (
      isProtectedFromAutomaticPunishment(
        member.guild,
        executorId
      )
    ) {
      await sendSecurityAlert(client, {
        title: 'SECURITY • Authorized Bot Add',
        description:
          'A protected owner/server-owner account added a bot.',
        fields: [
          {
            name: 'Added By',
            value: `<@${executorId}>\n\`${executorId}\``,
          },
          {
            name: 'Bot',
            value: `${member.user}\n\`${member.id}\``,
          },
          {
            name: 'Server',
            value: `${member.guild.name}\n\`${member.guild.id}\``,
          },
        ],
        color: 0x57F287,
      });

      return;
    }

    const executorMember = await member.guild.members
      .fetch(executorId)
      .catch(() => null);

    const punishment = await roleStripMember(
      executorMember,
      `Automatic security action: unauthorized bot add (${member.user.tag})`
    ).catch((error) => ({
      success: false,
      removed: 0,
      reason: error?.message || 'role_strip_failed',
    }));

    let botRemoved = false;

    if (member.kickable) {
      await member.kick(
        'Automatic security action: unauthorized bot addition'
      ).then(() => {
        botRemoved = true;
      }).catch(() => null);
    }

    await sendSecurityAlert(client, {
      title: 'SECURITY • Unauthorized Bot Add — Role Strip',
      description:
        'An unauthorized bot addition was detected.',
      fields: [
        {
          name: 'Added By',
          value: `<@${executorId}>\n\`${executorId}\``,
        },
        {
          name: 'Bot',
          value: `${member.user}\n\`${member.id}\``,
        },
        {
          name: 'Invoker Roles Removed',
          value: String(punishment.removed || 0),
          inline: true,
        },
        {
          name: 'Unauthorized Bot Removed',
          value: botRemoved ? 'Yes' : 'No',
          inline: true,
        },
        {
          name: 'Server',
          value: `${member.guild.name}\n\`${member.guild.id}\``,
        },
      ],
      color: 0xED4245,
    });
  },
};
