const {
  Events,
  AuditLogEvent,
} = require('discord.js');

const {
  getDangerousPermissions,
} = require('../services/permissionEscalationService');

const {
  isProtectedFromAutomaticPunishment,
  roleStripMember,
} = require('../services/securityPunishmentService');

const {
  sendSecurityAlert,
} = require('../services/securityAlertService');

function difference(after, before) {
  return after.filter((value) => !before.includes(value));
}

module.exports = {
  name: Events.GuildMemberUpdate,

  async execute(client, oldMember, newMember) {
    const oldDangerous = getDangerousPermissions(
      oldMember.permissions
    );

    const newDangerous = getDangerousPermissions(
      newMember.permissions
    );

    const gained = difference(
      newDangerous,
      oldDangerous
    );

    if (gained.length === 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 900));

    const logs = await newMember.guild.fetchAuditLogs({
      type: AuditLogEvent.MemberRoleUpdate,
      limit: 8,
    }).catch(() => null);

    const entry = logs?.entries.find(
      (auditEntry) =>
        auditEntry.target?.id === newMember.id
        && Date.now() - auditEntry.createdTimestamp < 15000
    );

    const executorId = entry?.executorId;

    if (!executorId) {
      await sendSecurityAlert(client, {
        title: 'SECURITY • Permission Escalation Detected',
        description:
          `${newMember} gained dangerous permissions, but the executor could not be identified.`,
        fields: [
          {
            name: 'Target',
            value: `${newMember}\n\`${newMember.id}\``,
            inline: false,
          },
          {
            name: 'Permissions Gained',
            value: gained.join(', '),
            inline: false,
          },
          {
            name: 'Server',
            value: `${newMember.guild.name}\n\`${newMember.guild.id}\``,
            inline: false,
          },
        ],
        color: 0xFEE75C,
      });

      return;
    }

    if (
      isProtectedFromAutomaticPunishment(
        newMember.guild,
        executorId
      )
    ) {
      return;
    }

    const executorMember = await newMember.guild.members
      .fetch(executorId)
      .catch(() => null);

    const punishment = await roleStripMember(
      executorMember,
      `Automatic security action: permission escalation on ${newMember.user.tag}`
    ).catch((error) => ({
      success: false,
      removed: 0,
      reason: error?.message || 'role_strip_failed',
    }));

    /*
     * Attempt to revert newly-added roles from this audit event if they
     * are manageable by the bot.
     */
    const addedRoleIds = [];

    for (const change of entry.changes || []) {
      if (change.key !== '$add') continue;

      for (const roleData of change.new || []) {
        if (roleData?.id) {
          addedRoleIds.push(roleData.id);
        }
      }
    }

    let reverted = 0;

    for (const roleId of addedRoleIds) {
      const role = newMember.guild.roles.cache.get(roleId);

      if (
        role
        && role.editable
        && newMember.roles.cache.has(role.id)
      ) {
        await newMember.roles.remove(
          role,
          'Reverted automatic permission escalation'
        ).then(() => {
          reverted++;
        }).catch(() => null);
      }
    }

    await sendSecurityAlert(client, {
      title: 'SECURITY • Permission Escalation — Role Strip',
      description:
        'An unauthorized dangerous-permission escalation was detected.',
      fields: [
        {
          name: 'Executor',
          value: `<@${executorId}>\n\`${executorId}\``,
          inline: false,
        },
        {
          name: 'Target',
          value: `${newMember}\n\`${newMember.id}\``,
          inline: false,
        },
        {
          name: 'Permissions Gained',
          value: gained.join(', '),
          inline: false,
        },
        {
          name: 'Executor Roles Removed',
          value: String(punishment.removed || 0),
          inline: true,
        },
        {
          name: 'Escalation Roles Reverted',
          value: String(reverted),
          inline: true,
        },
        {
          name: 'Server',
          value: `${newMember.guild.name}\n\`${newMember.guild.id}\``,
          inline: false,
        },
      ],
      color: 0xED4245,
    });
  },
};
