const db = require('../database/database');

async function processTemporaryRoles(client) {
  const expired = db.prepare(`
    SELECT guild_id, user_id, role_id FROM temporary_roles WHERE expires_at <= ?
  `).all(Date.now());

  for (const row of expired) {
    try {
      const guild = await client.guilds.fetch(row.guild_id);
      const member = await guild.members.fetch(row.user_id);
      await member.roles.remove(row.role_id, 'Temporary role expired');
    } catch (_) {
      // Ignore missing guilds, members, roles, and permission failures.
    } finally {
      db.prepare(`
        DELETE FROM temporary_roles
        WHERE guild_id = ? AND user_id = ? AND role_id = ?
      `).run(row.guild_id, row.user_id, row.role_id);
    }
  }
}

function startTemporaryRoleWorker(client) {
  processTemporaryRoles(client);
  return setInterval(() => processTemporaryRoles(client), 60_000);
}

module.exports = { processTemporaryRoles, startTemporaryRoleWorker };
