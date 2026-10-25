require('dotenv').config();

const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

if (!process.env.TOKEN || !process.env.CLIENT_ID) {
  throw new Error('TOKEN and CLIENT_ID must be set in .env');
}

const commands = [];
const commandDir = path.join(__dirname, 'commands');

for (const file of walk(commandDir).filter((f) => f.endsWith('.js'))) {
  const command = require(file);
  if (command.data) commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  console.log(`Deploying ${commands.length} global slash commands...`);
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
  console.log('Commands deployed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
