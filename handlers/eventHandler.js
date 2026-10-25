const fs = require('node:fs');
const path = require('node:path');

function loadEvents(client) {
  const eventDir = path.join(__dirname, '..', 'events');

  for (const file of fs.readdirSync(eventDir).filter((name) => name.endsWith('.js'))) {
    const event = require(path.join(eventDir, file));
    if (event.once) {
      client.once(event.name, (...args) => event.execute(client, ...args));
    } else {
      client.on(event.name, (...args) => event.execute(client, ...args));
    }
  }
}

module.exports = { loadEvents };
