const db = require('../database/database');
const { AuditLogEvent, PermissionsBitField } = require('discord.js');
const { hasWhitelist } = require('./permissionService');
const { sendLog } = require('./loggingService');
const { isOwner } = require('../utils/checks');

async function punish(member, punishment, reason) {
  if (!member || !member.manageable || punishment === 'none') return;

  if (punishment === 'rolestrip') {
    const roles = member.roles.cache.filter(
      (role) => role.id !== member.guild.id && role.editable
    );
    if (roles.size) await member.roles.remove(roles, reason);
  } else if (punishment === 'kick' && member.kickable) {
    await member.kick(reason);
  } else if (punishment === 'ban' && member.bannable) {
    await member.ban({ reason });
  }
}

async function handleProtectedRoleChange(oldMember, newMember) {
  const guild = newMember.guild;
  const added = newMember.roles.cache.filter((r) => !oldMember.roles.cache.has(r.id));
  const removed = oldMember.roles.cache.filter((r) => !newMember.roles.cache.has(r.id));
  const changed = [...added.values(), ...removed.values()];

  for (const role of changed) {
    const protection = db.prepare(`
      SELECT punishment FROM protected_roles WHERE guild_id = ? AND role_id = ?
    `).get(guild.id, role.id);

    if (!protection) continue;

    const logs = await guild.fetchAuditLogs({
      type: AuditLogEvent.MemberRoleUpdate,
      limit: 6,
    }).catch(() => null);

    const entry = logs?.entries.find(
      (item) => item.target?.id === newMember.id && Date.now() - item.createdTimestamp < 10_000
    );

    const executorId = entry?.executor?.id;
    if (!executorId || executorId === guild.client.user.id || isOwner(executorId)) continue;
    if (hasWhitelist(guild.id, executorId, 'Role-Protect')) continue;

    const executor = await guild.members.fetch(executorId).catch(() => null);
    await punish(executor, protection.punishment, `Unauthorized protected role modification: ${role.name}`)
      .catch(() => null);

    if (added.has(role.id) && role.editable) {
      await newMember.roles.remove(role, 'Reverted unauthorized protected role assignment').catch(() => null);
    }

    if (removed.has(role.id) && role.editable) {
      await newMember.roles.add(role, 'Reverted unauthorized protected role removal').catch(() => null);
    }

    await sendLog(guild.client, {
      title: 'Role Protection Triggered',
      description: `Unauthorized modification involving <@&${role.id}> was detected.`,
      fields: [
        { name: 'Executor', value: `<@${executorId}>`, inline: true },
        { name: 'Target', value: `<@${newMember.id}>`, inline: true },
        { name: 'Punishment', value: protection.punishment, inline: true },
      ],
      color: 0xED4245,
    });
  }
}

module.exports = { handleProtectedRoleChange };
