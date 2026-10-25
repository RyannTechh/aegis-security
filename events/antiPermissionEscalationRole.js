const {
  Events,
  AuditLogEvent,
} = require('discord.js');

const {
  getNewDangerousPermissions,
} = require('../services/permissionEscalationService');

const {
  isProtectedFromAutomaticPunishment,
  roleStripMember,
} = require('../services/securityPunishmentService');

const {
  sendSecurityAlert,
} = require('../services/securityAlertService');

module.exports = {
  name: Events.GuildRoleUpdate,

  async execute(client, oldRole, newRole) {
    const gained = getNewDangerousPermissions(
      oldRole.permissions,
      newRole.permissions
    );

    if (gained.length === 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 900));

    const logs = await newRole.guild.fetchAuditLogs({
      type: AuditLogEvent.RoleUpdate,
      limit: 8,
    }).catch(() => null);

    const entry = logs?.entries.find(
      (auditEntry) =>
        auditEntry.target?.id === newRole.id
        && Date.now() - auditEntry.createdTimestamp < 15000
    );

    const executorId = entry?.executorId;

    if (!executorId) {
      await sendSecurityAlert(client, {
        title: 'SECURITY • Role Permission Escalation',
        description:
          `${newRole} gained dangerous permissions, but the executor could not be identified.`,
        fields: [
          {
            name: 'Role',
            value: `${newRole}\n\`${newRole.id}\``,
          },
          {
            name: 'Permissions Gained',
            value: gained.join(', '),
          },
        ],
        color: 0xFEE75C,
      });

      return;
    }

    if (
      isProtectedFromAutomaticPunishment(
        newRole.guild,
        executorId
      )
    ) {
      return;
    }

    const executorMember = await newRole.guild.members
      .fetch(executorId)
      .catch(() => null);

    const punishment = await roleStripMember(
      executorMember,
      `Automatic security action: dangerous permissions added to role ${newRole.name}`
    ).catch((error) => ({
      success: false,
      removed: 0,
      reason: error?.message || 'role_strip_failed',
    }));

    let reverted = false;

    if (newRole.editable) {
      await newRole.setPermissions(
        oldRole.permissions,
        'Reverted automatic permission escalation'
      ).then(() => {
        reverted = true;
      }).catch(() => null);
    }

    await sendSecurityAlert(client, {
      title: 'SECURITY • Role Permission Escalation — Role Strip',
      description:
        'Dangerous permissions were added to a role without authorization.',
      fields: [
        {
          name: 'Executor',
          value: `<@${executorId}>\n\`${executorId}\``,
        },
        {
          name: 'Modified Role',
          value: `${newRole}\n\`${newRole.id}\``,
        },
        {
          name: 'Permissions Gained',
          value: gained.join(', '),
        },
        {
          name: 'Executor Roles Removed',
          value: String(punishment.removed || 0),
          inline: true,
        },
        {
          name: 'Role Permissions Restored',
          value: reverted ? 'Yes' : 'No',
          inline: true,
        },
        {
          name: 'Server',
          value: `${newRole.guild.name}\n\`${newRole.guild.id}\``,
        },
      ],
      color: 0xED4245,
    });
  },
};
