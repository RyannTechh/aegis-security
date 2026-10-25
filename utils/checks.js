function parseIds(value) {
  return String(value || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function isOwner(userId) {
  return parseIds(process.env.OWNER_IDS).includes(userId);
}

function memberHasAnyRole(member, envName) {
  if (!member) return false;
  const roleIds = parseIds(process.env[envName]);
  return roleIds.some((id) => member.roles.cache.has(id));
}

function canManageRole(member, role) {
  if (!member || !role) return false;
  if (isOwner(member.id)) return true;
  if (member.guild.ownerId === member.id) return true;
  return member.roles.highest.position > role.position;
}

module.exports = { parseIds, isOwner, memberHasAnyRole, canManageRole };
