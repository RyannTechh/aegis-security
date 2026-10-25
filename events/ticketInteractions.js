const {
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');

const {
  brandEmbed,
} = require('../utils/branding');
const {
  TICKET_TYPES,
  NORMAL_TICKET_KEYS,
  getTicketType,
  getCategoryId,
  canManageTicket,
  getTicketByChannel,
  createTicketChannel,
  setClaimedBy,
  changeTicketType,
  closeTicket,
  makeTicketChannelName,
} = require('../services/ticketService');

function ticketControls(ticketId, claimedBy = null) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket:claim:${ticketId}`)
      .setLabel(claimedBy ? 'Claimed' : 'Claim')
      .setEmoji('👋')
      .setStyle(ButtonStyle.Success)
      .setDisabled(Boolean(claimedBy)),
    new ButtonBuilder()
      .setCustomId(`ticket:close:${ticketId}`)
      .setLabel('Close Ticket')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`ticket:move:${ticketId}`)
      .setLabel('Change Category')
      .setEmoji('📂')
      .setStyle(ButtonStyle.Secondary)
  );
}

function buildOpeningEmbed(ticket, opener, type) {
  return brandEmbed(
    new EmbedBuilder()
      .setColor(0x19D3FF)
      .setTitle(`${type.emoji} ${type.label}`)
      .setDescription(
        `• **Ticket Opened By:** ${opener}\n\n`
        + `▌ **Claimed By:**\nNot claimed\n\n`
        + `**What is your question?**\n`
        + `\`${ticket.question || 'No question provided'}\`\n\n`
        + `**How can our support team assist you?**\n`
        + `\`${ticket.support_details || 'No additional details provided'}\``
      )
  );
}

function makeMoveMenu(currentType) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('ticket:move-select')
    .setPlaceholder('Move ticket to another section...')
    .setMinValues(1)
    .setMaxValues(1);

  for (const [key, type] of Object.entries(TICKET_TYPES)) {
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(type.label)
        .setValue(key)
        .setDescription(type.description.slice(0, 100))
        .setEmoji(type.emoji)
        .setDefault(key === currentType)
    );
  }

  return new ActionRowBuilder().addComponents(menu);
}

async function showTicketModal(interaction, typeKey) {
  const type = getTicketType(typeKey);
  if (!type) {
    return interaction.reply({
      content: 'That ticket category does not exist.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`ticket:create:${typeKey}`)
    .setTitle(`${type.label}`.slice(0, 45));

  const question = new TextInputBuilder()
    .setCustomId('question')
    .setLabel('What is your question?')
    .setPlaceholder('Tell us what you need help with...')
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(1)
    .setMaxLength(1000)
    .setRequired(true);

  const details = new TextInputBuilder()
    .setCustomId('support_details')
    .setLabel('How can our support team assist you?')
    .setPlaceholder('Add any extra details here...')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(1000)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(question),
    new ActionRowBuilder().addComponents(details)
  );

  return interaction.showModal(modal);
}

async function handleCreateModal(interaction) {
  const typeKey = interaction.customId.split(':')[2];
  const type = getTicketType(typeKey);

  if (!type) {
    return interaction.reply({
      content: 'That ticket category is no longer available.',
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const opener = await interaction.guild.members
    .fetch(interaction.user.id)
    .catch(() => null);

  if (!opener) {
    return interaction.editReply('Could not find your server member profile.');
  }

  const question = interaction.fields.getTextInputValue('question').trim();
  const supportDetails = interaction.fields.getTextInputValue('support_details').trim();

  let result;

  try {
    result = await createTicketChannel({
      guild: interaction.guild,
      opener,
      typeKey,
      question,
      supportDetails,
    });
  } catch (error) {
    return interaction.editReply({
      content: `Ticket creation failed: ${error.message}`,
    });
  }

  if (result.duplicate) {
    return interaction.editReply({
      content: `You already have an open ticket: ${result.channel}`,
    });
  }

  const openingEmbed = buildOpeningEmbed(
    result.ticket,
    opener,
    type
  );

  openingEmbed
    .setImage(null)
    .setThumbnail(
      interaction.client.user.displayAvatarURL({
        extension: 'png',
        size: 256,
      })
    );

  await result.channel.send({
    content: `${opener}`,
    embeds: [openingEmbed],
    components: [ticketControls(result.ticket.id)],
    allowedMentions: { users: [opener.id] },
  });

  return interaction.editReply({
    content: `Your **${type.label}** has been created: ${result.channel}`,
  });
}

async function handleClaim(interaction) {
  const ticket = getTicketByChannel(interaction.channelId);

  if (!ticket) {
    return interaction.reply({
      content: 'This channel is not an active ticket.',
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!canManageTicket(interaction.member, interaction.channel)) {
    return interaction.reply({
      content: 'You need Manage Channels or Manage Messages permission in this ticket to claim it.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const claim = setClaimedBy(
    interaction.channelId,
    interaction.user.id
  );

  if (!claim.success) {
    return interaction.reply({
      content: claim.claimedBy
        ? `🔒 This ticket is already permanently claimed by <@${claim.claimedBy}>.`
        : 'This ticket could not be claimed.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const embed = interaction.message.embeds[0]
    ? EmbedBuilder.from(interaction.message.embeds[0])
    : new EmbedBuilder().setTitle('Ticket');

  const original = embed.data.description || '';
  const updated = original.replace(
    /▌ \*\*Claimed By:\*\*\n[^\n]*/,
    `▌ **Claimed By:**\n${interaction.user}`
  );

  embed
    .setDescription(updated)
    .setImage(null)
    .setThumbnail(
      interaction.client.user.displayAvatarURL({
        extension: 'png',
        size: 256,
      })
    );

  return interaction.update({
    embeds: [embed],
    components: [
      ticketControls(
        ticket.id,
        interaction.user.id
      ),
    ],
  });
}

async function handleClose(interaction) {
  const ticket = getTicketByChannel(interaction.channelId);

  if (!ticket) {
    return interaction.reply({
      content: 'This channel is not an active ticket.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const isOpener = interaction.user.id === ticket.opener_id;
  if (!isOpener && !canManageTicket(interaction.member, interaction.channel)) {
    return interaction.reply({
      content: 'Only the ticket opener or someone with ticket management permissions can close this ticket.',
      flags: MessageFlags.Ephemeral,
    });
  }

  closeTicket(interaction.channelId, interaction.user.id);

  await interaction.reply({
    content: `🔒 Ticket closed by ${interaction.user}. This channel will be deleted in **5 seconds**.`,
  });

  setTimeout(() => {
    interaction.channel.delete(
      `SALRP ticket closed by ${interaction.user.tag}`
    ).catch(() => null);
  }, 5000);
}

async function handleMoveButton(interaction) {
  const ticket = getTicketByChannel(interaction.channelId);

  if (!ticket) {
    return interaction.reply({
      content: 'This channel is not an active ticket.',
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!canManageTicket(interaction.member, interaction.channel)) {
    return interaction.reply({
      content: 'You need Manage Channels or Manage Messages permission in this ticket to move it.',
      flags: MessageFlags.Ephemeral,
    });
  }

  return interaction.reply({
    content: 'Choose the new ticket section:',
    components: [makeMoveMenu(ticket.ticket_type)],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleMoveSelect(interaction) {
  const ticket = getTicketByChannel(interaction.channelId);

  if (!ticket) {
    return interaction.update({
      content: 'This channel is not an active ticket.',
      components: [],
    });
  }

  if (!canManageTicket(interaction.member, interaction.channel)) {
    return interaction.update({
      content: 'You are not allowed to move this ticket.',
      components: [],
    });
  }

  const newTypeKey = interaction.values[0];
  const newType = getTicketType(newTypeKey);

  if (!newType) {
    return interaction.update({
      content: 'That ticket section no longer exists.',
      components: [],
    });
  }

  const categoryId = getCategoryId(newTypeKey);
  if (!categoryId) {
    return interaction.update({
      content: `${newType.categoryEnv} is not configured in .env.`,
      components: [],
    });
  }

  const category =
    interaction.guild.channels.cache.get(categoryId)
    || await interaction.guild.channels.fetch(categoryId).catch(() => null);

  if (!category) {
    return interaction.update({
      content: 'The configured destination category could not be found.',
      components: [],
    });
  }

  await interaction.channel.setParent(category.id, {
    lockPermissions: false,
    reason: `Ticket moved to ${newType.label} by ${interaction.user.tag}`,
  });

  await interaction.channel.setName(
    makeTicketChannelName(newType, ticket.opener_id),
    `Ticket category changed by ${interaction.user.tag}`
  ).catch(() => null);

  await interaction.channel.setTopic(
    `SALRP Ticket #${ticket.id} | ${newType.label} | User ${ticket.opener_id}`,
    `Ticket category changed by ${interaction.user.tag}`
  ).catch(() => null);

  changeTicketType(interaction.channelId, newTypeKey);

  await interaction.update({
    content: `✅ Ticket moved to **${newType.label}**.`,
    components: [],
  });

  await interaction.channel.send({
    content: `📂 ${interaction.user} moved this ticket to **${newType.label}**.`,
    allowedMentions: { users: [] },
  }).catch(() => null);
}

module.exports = {
  name: Events.InteractionCreate,

  async execute(client, interaction) {
    try {
      if (
        interaction.isStringSelectMenu()
        && (
          interaction.customId === 'ticket:panel:normal'
          || interaction.customId === 'ticket:panel:censored'
        )
      ) {
        return showTicketModal(interaction, interaction.values[0]);
      }

      if (
        interaction.isModalSubmit()
        && interaction.customId.startsWith('ticket:create:')
      ) {
        return handleCreateModal(interaction);
      }

      if (interaction.isButton()) {
        if (interaction.customId.startsWith('ticket:claim:')) {
          return handleClaim(interaction);
        }

        if (interaction.customId.startsWith('ticket:close:')) {
          return handleClose(interaction);
        }

        if (interaction.customId.startsWith('ticket:move:')) {
          return handleMoveButton(interaction);
        }
      }

      if (
        interaction.isStringSelectMenu()
        && interaction.customId === 'ticket:move-select'
      ) {
        return handleMoveSelect(interaction);
      }
    } catch (error) {
      console.error('[TICKETS] Interaction failed:', error);

      const payload = {
        content: `Ticket action failed: ${error.message || 'Unknown error'}`,
        flags: MessageFlags.Ephemeral,
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => null);
      } else {
        await interaction.reply(payload).catch(() => null);
      }
    }
  },
};
