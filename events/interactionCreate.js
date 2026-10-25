const {
  Events,
  MessageFlags,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');

const db = require('../database/database');
const { errorEmbed } = require('../utils/embeds');
const { parseIds, isOwner } = require('../utils/checks');
const { globalUnban } = require('../services/globalActionService');

function canReviewAlt(interaction) {
  return isOwner(interaction.user.id)
    || interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)
    || parseIds(process.env.ALT_REVIEW_ROLE_IDS).some((id) => interaction.member?.roles?.cache?.has(id));
}

function canReviewGlobalBan(interaction) {
  return isOwner(interaction.user.id)
    || interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)
    || parseIds(process.env.GLOBAL_BAN_REVIEW_ROLE_IDS).some((id) => interaction.member?.roles?.cache?.has(id));
}

async function handleAltButton(interaction) {
  const [action, guildId, userId] = interaction.customId.split(':');

  if (interaction.guildId !== guildId) {
    return interaction.reply({ content: 'This alert belongs to another server.', flags: MessageFlags.Ephemeral });
  }
  if (!canReviewAlt(interaction)) {
    return interaction.reply({ content: 'You are not allowed to review potential-alt alerts.', flags: MessageFlags.Ephemeral });
  }

  if (action === 'alt_dismiss') {
    await interaction.update({
      components: [],
      embeds: interaction.message.embeds.map((embed) => {
        const data = embed.toJSON();
        data.color = 0x57F287;
        data.footer = { text: `Dismissed by ${interaction.user.tag}` };
        return data;
      }),
    });
    return;
  }

  const member = await interaction.guild.members.fetch(userId).catch(() => null);
  const roleId = process.env.CENSORED_ROLE_ID || '1533606425480134758';
  const role = interaction.guild.roles.cache.get(roleId);

  if (!member) return interaction.reply({ content: 'That member is no longer in the server.', flags: MessageFlags.Ephemeral });
  if (!role?.editable) return interaction.reply({ content: 'The censored role is missing or cannot be assigned.', flags: MessageFlags.Ephemeral });

  await member.roles.add(role, `Potential-alt alert approved by ${interaction.user.tag}`);
  await interaction.update({
    components: [],
    embeds: interaction.message.embeds.map((embed) => {
      const data = embed.toJSON();
      data.color = 0xED4245;
      data.footer = { text: `Censored role given by ${interaction.user.tag}` };
      return data;
    }),
  });
}

function updatedCaseEmbed(message, statusText, reviewer, color) {
  const original = message.embeds[0]?.toJSON() || {};
  const embed = EmbedBuilder.from(original)
    .setColor(color)
    .addFields({ name: 'Management Review', value: `${statusText} by ${reviewer} (\`${reviewer.id}\`)` })
    .setTimestamp();
  return embed;
}

async function handleGlobalBanButton(interaction, client) {
  if (!canReviewGlobalBan(interaction)) {
    return interaction.reply({ content: 'You are not allowed to review global bans.', flags: MessageFlags.Ephemeral });
  }

  const [action, caseId] = interaction.customId.split(':');
  const banCase = db.prepare('SELECT * FROM global_ban_cases WHERE case_id = ?').get(caseId);

  if (!banCase) {
    return interaction.reply({ content: 'This global-ban case no longer exists in the database.', flags: MessageFlags.Ephemeral });
  }

  if (action === 'gb_remind') {
    const cooldown = 5 * 60 * 1000;
    if (banCase.last_reminded_at && Date.now() - banCase.last_reminded_at < cooldown) {
      return interaction.reply({ content: 'A proof reminder was already sent recently.', flags: MessageFlags.Ephemeral });
    }

    db.prepare('UPDATE global_ban_cases SET last_reminded_at = ? WHERE case_id = ?').run(Date.now(), caseId);
    await interaction.reply({
      content: `<@${banCase.staff_id}> please add the required proof for global-ban case \`${caseId}\` in a thread under this message.`,
      allowedMentions: { users: [banCase.staff_id] },
    });
    return;
  }

  if (banCase.status !== 'pending') {
    return interaction.reply({ content: `This case has already been marked **${banCase.status}**.`, flags: MessageFlags.Ephemeral });
  }

  if (action === 'gb_approve') {
    db.prepare(`
      UPDATE global_ban_cases
      SET status = 'approved', reviewed_by = ?, reviewed_at = ?
      WHERE case_id = ?
    `).run(interaction.user.id, Date.now(), caseId);

    await interaction.update({
      embeds: [updatedCaseEmbed(interaction.message, 'Approved', interaction.user, 0x57F287)],
      components: [],
    });
    return;
  }

  if (action === 'gb_revoke') {
    await interaction.deferUpdate();
    const results = await globalUnban(client, banCase.offender_id, `Global ban revoked by ${interaction.user.tag} | Case ${caseId}`);
    const unbanned = results.filter((r) => r.ok && !r.skipped).length;
    const failed = results.filter((r) => !r.ok).length;

    db.prepare(`
      UPDATE global_ban_cases
      SET status = 'revoked', reviewed_by = ?, reviewed_at = ?
      WHERE case_id = ?
    `).run(interaction.user.id, Date.now(), caseId);

    const embed = updatedCaseEmbed(interaction.message, `Revoked — unbanned in ${unbanned} server(s), ${failed} failure(s)`, interaction.user, 0xED4245);
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(client, interaction) {
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);

      if (!command || typeof command.autocomplete !== 'function') {
        await interaction.respond([]).catch(() => null);
        return;
      }

      try {
        await command.autocomplete(interaction, client);
      } catch (error) {
        console.error(`Autocomplete failed for /${interaction.commandName}:`, error);

        if (!interaction.responded) {
          await interaction.respond([]).catch(() => null);
        }
      }

      return;
    }

    if (interaction.isButton()) {
      try {
        if (interaction.customId.startsWith('alt_approve:') || interaction.customId.startsWith('alt_dismiss:')) {
          await handleAltButton(interaction);
          return;
        }

        if (interaction.customId.startsWith('gb_approve:')
          || interaction.customId.startsWith('gb_revoke:')
          || interaction.customId.startsWith('gb_remind:')) {
          await handleGlobalBanButton(interaction, client);
          return;
        }
      } catch (error) {
        console.error(error);
        const payload = { content: error.message || 'The button action failed.', flags: MessageFlags.Ephemeral };
        if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
        else await interaction.reply(payload).catch(() => null);
        return;
      }
    }

    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error(error);
      const payload = {
        embeds: [errorEmbed('Command failed', error.message || 'An unknown error occurred.')],
        flags: MessageFlags.Ephemeral,
      };

      if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
      else await interaction.reply(payload).catch(() => null);
    }
  },
};
