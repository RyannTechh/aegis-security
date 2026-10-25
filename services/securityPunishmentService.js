const {
  isOwner,
} = require('../utils/checks');

function isProtectedFromAutomaticPunishment(guild, userId) {
  if (!userId) return true;
  if (userId === guild.client.user.id) return true;
  if (userId === guild.ownerId) return true;
  if (isOwner(userId)) return true;

  return false;
}

async function roleStripMember(member, reason) {
  if (!member) {
    return {
      success: false,
      removed: 0,
      reason: 'member_not_found',
    };
  }

  const removableRoles = member.roles.cache.filter(
    (role) =>
      role.id !== member.guild.id
      && !role.managed
      && role.editable
  );

  if (removableRoles.size === 0) {
    return {
      success: true,
      removed: 0,
      reason: 'no_manageable_roles',
    };
  }

  await member.roles.remove(
    removableRoles,
    reason
  );

  return {
    success: true,
    removed: removableRoles.size,
    reason: 'roles_removed',
  };
}

module.exports = {
  isProtectedFromAutomaticPunishment,
  roleStripMember,
};
