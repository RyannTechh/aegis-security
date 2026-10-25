const path = require('node:path');
const { AttachmentBuilder } = require('discord.js');

const BRAND_NAME = 'Aegis Security';
const BRAND_LOGO_NAME = 'miami-roleplay-logo.png';
const BRAND_LOGO_PATH = path.join(__dirname, '..', 'assets', BRAND_LOGO_NAME);
const BRAND_LOGO_ATTACHMENT = `attachment://${BRAND_LOGO_NAME}`;

function brandEmbed(embed, options = {}) {
  if (!embed) return embed;

  if (options.thumbnail !== false) {
    embed.setThumbnail(BRAND_LOGO_ATTACHMENT);
  }

  if (options.footer !== false) {
    embed.setFooter({ text: options.footerText || BRAND_NAME });
  }

  return embed;
}

function brandFiles() {
  return [
    new AttachmentBuilder(BRAND_LOGO_PATH, {
      name: BRAND_LOGO_NAME,
    }),
  ];
}

function withBrandFiles(payload = {}) {
  return {
    ...payload,
    files: [
      ...(payload.files || []),
      ...brandFiles(),
    ],
  };
}

module.exports = {
  BRAND_NAME,
  BRAND_LOGO_NAME,
  BRAND_LOGO_PATH,
  BRAND_LOGO_ATTACHMENT,
  brandEmbed,
  brandFiles,
  withBrandFiles,
};
