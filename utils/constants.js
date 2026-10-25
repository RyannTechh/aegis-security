const WHITELIST_PERMISSIONS = Object.freeze([
  'All',
  'Bot-Add',
  'Channel-Delete',
  'Role-Delete',
  'Admin-Role',
  'Role-Protect',
  'Webhook-Create',
]);

const PUNISHMENTS = Object.freeze(['none', 'rolestrip', 'kick', 'ban']);

module.exports = { WHITELIST_PERMISSIONS, PUNISHMENTS };
