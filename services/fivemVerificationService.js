const http = require('http');
const crypto = require('crypto');
const db = require('../database/database');
const {
  normalizeIp,
  enforceIpBan,
} = require('./ipBanService');

db.exec(`
  CREATE TABLE IF NOT EXISTS fivem_verification_joins (
    discord_id TEXT PRIMARY KEY,
    player_name TEXT,
    license_id TEXT,
    fivem_id TEXT,
    server_player_id TEXT,
    ip_address TEXT,
    joined_at INTEGER NOT NULL,
    verified_at INTEGER
  );
`);

// Existing databases created before IP bans will not have this column yet.
const joinColumns = db.prepare('PRAGMA table_info(fivem_verification_joins)').all();
if (!joinColumns.some((column) => column.name === 'ip_address')) {
  db.exec('ALTER TABLE fivem_verification_joins ADD COLUMN ip_address TEXT;');
}

function getWindowMinutes() {
  const value = Number(process.env.FIVEM_VERIFY_WINDOW_MINUTES || 30);
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : 30;
}

function saveJoin(data) {
  db.prepare(`
    INSERT INTO fivem_verification_joins (
      discord_id, player_name, license_id, fivem_id,
      server_player_id, ip_address, joined_at, verified_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
    ON CONFLICT(discord_id) DO UPDATE SET
      player_name = excluded.player_name,
      license_id = excluded.license_id,
      fivem_id = excluded.fivem_id,
      server_player_id = excluded.server_player_id,
      ip_address = excluded.ip_address,
      joined_at = excluded.joined_at,
      verified_at = NULL
  `).run(
    data.discordId,
    data.playerName || null,
    data.licenseId || null,
    data.fivemId || null,
    data.serverPlayerId || null,
    data.ipAddress || null,
    Date.now()
  );
}

function getRecentJoin(discordId) {
  const row = db.prepare(`
    SELECT *
    FROM fivem_verification_joins
    WHERE discord_id = ?
    LIMIT 1
  `).get(discordId);

  if (!row) return null;

  const maxAge = getWindowMinutes() * 60 * 1000;
  return Date.now() - row.joined_at <= maxAge ? row : null;
}

function markVerified(discordId) {
  db.prepare(`
    UPDATE fivem_verification_joins
    SET verified_at = ?
    WHERE discord_id = ?
  `).run(Date.now(), discordId);
}

function secretsMatch(received, configured) {
  if (!received || !configured) return false;
  const a = Buffer.from(String(received));
  const b = Buffer.from(String(configured));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function startFiveMVerificationApi(client) {
  const port = Number(process.env.FIVEM_VERIFY_API_PORT || 30125);
  const secret = String(process.env.FIVEM_VERIFY_SECRET || '').trim();

  if (!secret) {
    console.error('[FIVEM VERIFY] FIVEM_VERIFY_SECRET is empty. API not started.');
    return;
  }

  if (client.__fivemVerificationServer) return;

  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/fivem/verification/join') {
      res.writeHead(404);
      return res.end('Not found');
    }

    if (!secretsMatch(req.headers['x-salrp-verify-secret'], secret)) {
      res.writeHead(401);
      return res.end('Unauthorized');
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 50000) req.destroy();
    });

    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const discordId = String(data.discord_id || '').trim();

        if (!/^\d{17,20}$/.test(discordId)) {
          res.writeHead(400);
          return res.end('Invalid Discord ID');
        }

        // IMPORTANT: this must be the player's endpoint supplied by the trusted
        // FiveM server-side resource, not req.socket.remoteAddress. The HTTP
        // connection itself normally comes from the FiveM server machine.
        const suppliedIp = String(data.ip_address || data.ip || '').trim();
        const ipAddress = suppliedIp ? normalizeIp(suppliedIp) : null;

        if (suppliedIp && !ipAddress) {
          res.writeHead(400);
          return res.end('Invalid IP address');
        }

        saveJoin({
          discordId,
          playerName: String(data.player_name || '').slice(0, 128),
          licenseId: String(data.license_id || '').slice(0, 128),
          fivemId: String(data.fivem_id || '').slice(0, 128),
          serverPlayerId: String(data.server_player_id || '').slice(0, 32),
          ipAddress,
        });

        if (ipAddress) {
          const enforcement = await enforceIpBan(client, discordId, ipAddress);
          const matchedBan = enforcement.some((result) => result.ok || result.error !== 'guild_not_found');

          if (matchedBan) {
            console.log(`[IP BAN] Blocked Discord ID ${discordId} from banned IP ${ipAddress}.`);
            res.writeHead(403, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
              ok: false,
              banned: true,
              message: 'This IP address is banned.',
            }));
          }
        }

        console.log(`[FIVEM VERIFY] Recorded join for Discord ID ${discordId}.`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: true }));
      } catch (error) {
        console.error('[FIVEM VERIFY] Bad request:', error);
        res.writeHead(400);
        return res.end('Bad request');
      }
    });
  });

  server.on('error', (error) => {
    console.error('[FIVEM VERIFY] HTTP server error:', error);
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`[FIVEM VERIFY] Listening on port ${port}`);
  });

  client.__fivemVerificationServer = server;
}

module.exports = {
  getWindowMinutes,
  getRecentJoin,
  markVerified,
  startFiveMVerificationApi,
};
