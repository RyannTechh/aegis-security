const {
  Events,
} = require('discord.js');

const {
  sendMasterLog,
} = require('../services/masterLoggingService');

function formatOptions(interaction) {
  const result = [];

  function read(options, prefix = '') {
    for (const option of options || []) {
      if (Array.isArray(option.options)) {
        read(option.options, `${prefix}${option.name} `);
        continue;
      }

      let value = option.value;

      if (option.user) {
        value = `${option.user.tag} (${option.user.id})`;
      } else if (option.member?.user) {
        value = `${option.member.user.tag} (${option.member.id})`;
      } else if (option.role) {
        value = `${option.role.name} (${option.role.id})`;
      } else if (option.channel) {
        value = `#${option.channel.name} (${option.channel.id})`;
      } else if (option.attachment) {
        value = `${option.attachment.name} (${option.attachment.id})`;
      }

      result.push(
        `• ${prefix}${option.name}: ${String(value ?? 'None').slice(0, 500)}`
      );
    }
  }

  read(interaction.options?.data || []);

  return result.length
    ? result.join('\n').slice(0, 3900)
    : 'No options';
}

module.exports = {
  name: Events.InteractionCreate,

  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    let subcommand = null;

    try {
      subcommand = interaction.options.getSubcommand(false);
    } catch (_) {
      subcommand = null;
    }

    await sendMasterLog(client, {
      title: 'MASTER LOG • Command Used',
      description:
        `**/${interaction.commandName}${subcommand ? ` ${subcommand}` : ''}** was used.`,
      fields: [
        {
          name: 'User',
          value: `${interaction.user}\n\`${interaction.user.id}\``,
          inline: true,
        },
        {
          name: 'Server',
          value: interaction.guild
            ? `${interaction.guild.name}\n\`${interaction.guild.id}\``
            : 'DM',
          inline: true,
        },
        {
          name: 'Channel',
          value: interaction.channel
            ? `<#${interaction.channel.id}>\n\`${interaction.channel.id}\``
            : 'Unknown',
          inline: true,
        },
        {
          name: 'Options',
          value: formatOptions(interaction),
          inline: false,
        },
      ],
      color: 0x5865F2,
    });
  },
};
