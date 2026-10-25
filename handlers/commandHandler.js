const fs = require('node:fs');
const path = require('node:path');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function loadCommands(client) {
  const commandDir = path.join(__dirname, '..', 'commands');
  for (const file of walk(commandDir).filter((f) => f.endsWith('.js'))) {
    const command = require(file);
    if (!command.data || !command.execute) {
      console.warn(`Skipping invalid command file: ${file}`);
      continue;
    }
    client.commands.set(command.data.name, command);
  }
}

module.exports = { loadCommands };
