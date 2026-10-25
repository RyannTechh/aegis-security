const {
  Events,
} = require('discord.js');

const {
  getEmojiKey,
  getReactionRole,
} = require('../services/reactionRoleService');

module.exports = {
  name: Events.MessageReactionRemove,

  async execute(client, reaction, user) {
    if (user.bot) return;

    try {
      if (reaction.partial) {
        await reaction.fetch();
      }

      if (reaction.message.partial) {
        await reaction.message.fetch();
      }

      const guild = reaction.message.guild;
      if (!guild) return;

      const emojiKey = getEmojiKey(reaction.emoji);

      const mapping = getReactionRole(
        guild.id,
        reaction.message.id,
        emojiKey
      );

      if (!mapping) return;

      const member = await guild.members.fetch(user.id);
      const role = await guild.roles.fetch(mapping.role_id).catch(() => null);

      if (!role || role.managed || !role.editable) {
        return;
      }

      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(
          role,
          'Reaction role removed'
        );
      }
    } catch (error) {
      console.error('Failed to remove reaction role:', error);
    }
  },
};
