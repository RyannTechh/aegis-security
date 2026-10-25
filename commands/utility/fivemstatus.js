const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const db = require('../../database/database');

function getJoinCode() {
  return String(process.env.FIVEM_JOIN_CODE || '')
    .trim()
    .replace(/^https?:\/\/cfx\.re\/join\//i, '')
    .replace(/^cfx\.re\/join\//i, '')
    .replace(/^join\//i, '')
    .replace(/\//g, '');
}

function cleanBaseUrl(value) {
  return String(value || '')
    .trim()
    .replace(/\/+$/, '');
}

function normalizeUrl(value) {
  const raw = String(value || '').trim();

  if (!raw) {
    return '';
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  return `https://${raw}`;
}

function isValidHttpUrl(value) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);

    return (
      url.protocol === 'http:'
      || url.protocol === 'https:'
    );
  } catch {
    return false;
  }
}

async function fetchJson(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'SALRP-FiveM-Status/5.0',
      },
    });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCfxServer(joinCode) {
  const endpoints = [
    `https://frontend.cfx-services.net/api/servers/single/${encodeURIComponent(joinCode)}`,
    `https://servers-frontend.fivem.net/api/servers/single/${encodeURIComponent(joinCode)}`,
  ];

  const errors = [];

  for (const url of endpoints) {
    try {
      const json = await fetchJson(
        url,
        10000
      );

      return {
        json,
        source:
          url.includes('cfx-services.net')
            ? 'CFX Services'
            : 'FiveM Frontend',
      };
    } catch (error) {
      errors.push(
        `${url} -> ${error?.message || 'Unknown error'}`
      );
    }
  }

  throw new Error(
    errors.join(' | ')
  );
}

async function fetchDirectServer(baseUrl) {
  if (!baseUrl) {
    return null;
  }

  const [dynamic, players] =
    await Promise.all([
      fetchJson(
        `${baseUrl}/dynamic.json`,
        7000
      ),
      fetchJson(
        `${baseUrl}/players.json`,
        7000
      ),
    ]);

  return {
    dynamic,
    players:
      Array.isArray(players)
        ? players
        : [],
  };
}

function progressBar(
  current,
  max,
  length = 12
) {
  if (!max || max <= 0) {
    return '▱'.repeat(length);
  }

  const ratio = Math.max(
    0,
    Math.min(1, current / max)
  );

  const filled = Math.round(
    ratio * length
  );

  return (
    '▰'.repeat(filled)
    + '▱'.repeat(length - filled)
  );
}

function cleanHostname(value) {
  return String(
    value
    || 'San Andreas Life Roleplay'
  )
    .replace(/\^[0-9]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1024);
}

function buildButtons(
  joinCode,
  communityUrl
) {
  const row =
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Connect to SALRP')
        .setEmoji('🎮')
        .setStyle(ButtonStyle.Link)
        .setURL(
          `https://cfx.re/join/${joinCode}`
        )
    );

  const normalizedCommunityUrl =
    normalizeUrl(communityUrl);

  if (
    normalizedCommunityUrl
    && isValidHttpUrl(
      normalizedCommunityUrl
    )
  ) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel('Community')
        .setEmoji('💬')
        .setStyle(ButtonStyle.Link)
        .setURL(
          normalizedCommunityUrl
        )
    );
  }

  return row;
}

function buildOnlineEmbed(
  interaction,
  {
    currentPlayers,
    maxPlayers,
    hostname,
    gametype,
    mapName,
    endpoint,
    responseTime,
    joinCode,
    source,
    onlineEmoji,
  }
) {
  const percentage =
    maxPlayers > 0
      ? Math.round(
          (currentPlayers / maxPlayers)
          * 100
        )
      : 0;

  return new EmbedBuilder()
    .setColor(0x3498DB)
    .setAuthor({
      name:
        'San Andreas Life Roleplay',
      iconURL:
        interaction.guild.iconURL({
          extension: 'png',
          size: 128,
        }) || undefined,
    })
    .setTitle(
      'FiveM Server Status'
    )
    .setDescription(
      `${onlineEmoji} **ONLINE**\n`
      + 'SALRP is online and accepting connections.'
    )
    .addFields(
      {
        name: '👥 Players',
        value:
          `**${currentPlayers} / ${maxPlayers || '?'}**\n`
          + `${progressBar(
            currentPlayers,
            maxPlayers
          )}  **${percentage}%**`,
        inline: true,
      },
      {
        name: '📡 Status Response',
        value:
          `**${responseTime} ms**`,
        inline: true,
      },
      {
        name: '🔗 Join Code',
        value: `\`${joinCode}\``,
        inline: true,
      },
      {
        name: '🎮 Server',
        value:
          cleanHostname(hostname),
        inline: false,
      },
      {
        name: '🗺️ Map',
        value:
          String(
            mapName
            || 'San Andreas'
          ).slice(0, 1024),
        inline: true,
      },
      {
        name: '🎭 Gamemode',
        value:
          String(
            gametype
            || 'Roleplay'
          ).slice(0, 1024),
        inline: true,
      }
    )
    .setThumbnail(
      interaction.guild.iconURL({
        extension: 'png',
        size: 256,
      }) || null
    )
    .setFooter({
      text:
        `SALRP • Live FiveM Status • ${source}`,
      iconURL:
        interaction.guild.iconURL({
          extension: 'png',
          size: 64,
        }) || undefined,
    })
    .setTimestamp();
}


function getCustomEmoji(interaction, emojiId, fallback) {
  const emoji =
    interaction.client.emojis.cache.get(emojiId);

  return emoji
    ? emoji.toString()
    : fallback;
}



db.exec(`
  CREATE TABLE IF NOT EXISTS fivem_monitoring_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    current_online_since INTEGER,
    last_online_at INTEGER,
    last_offline_at INTEGER,
    last_recovery_at INTEGER,
    all_time_peak INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS fivem_monitoring_daily (
    day_key TEXT PRIMARY KEY,
    peak_players INTEGER NOT NULL DEFAULT 0,
    sample_count INTEGER NOT NULL DEFAULT 0,
    player_sum INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS fivem_monitoring_unique (
    day_key TEXT NOT NULL,
    player_key TEXT NOT NULL,
    first_seen_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    PRIMARY KEY (day_key, player_key)
  );
`);

function getMonitoringDayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getMonitoringState() {
  return db.prepare(`
    SELECT *
    FROM fivem_monitoring_state
    WHERE id = 1
  `).get() || {
    current_online_since: null,
    last_online_at: null,
    last_offline_at: null,
    last_recovery_at: null,
    all_time_peak: 0,
    updated_at: Date.now(),
  };
}

function saveMonitoringState(state) {
  db.prepare(`
    INSERT OR REPLACE INTO fivem_monitoring_state (
      id,
      current_online_since,
      last_online_at,
      last_offline_at,
      last_recovery_at,
      all_time_peak,
      updated_at
    )
    VALUES (1, ?, ?, ?, ?, ?, ?)
  `).run(
    state.current_online_since || null,
    state.last_online_at || null,
    state.last_offline_at || null,
    state.last_recovery_at || null,
    Number(state.all_time_peak || 0),
    Date.now()
  );
}

function updateMonitoringState(online, currentPlayers) {
  const now = Date.now();
  const state = getMonitoringState();

  if (online) {
    if (!state.current_online_since) {
      state.current_online_since = now;

      if (state.last_offline_at) {
        state.last_recovery_at = now;
      }
    }

    state.last_online_at = now;
    state.all_time_peak = Math.max(
      Number(state.all_time_peak || 0),
      Number(currentPlayers || 0)
    );
  } else {
    if (state.current_online_since) {
      state.current_online_since = null;
      state.last_offline_at = now;
    } else if (!state.last_offline_at) {
      state.last_offline_at = now;
    }
  }

  saveMonitoringState(state);
  return state;
}

function recordMonitoringDaily(currentPlayers) {
  const dayKey = getMonitoringDayKey();

  db.prepare(`
    INSERT INTO fivem_monitoring_daily (
      day_key,
      peak_players,
      sample_count,
      player_sum,
      updated_at
    )
    VALUES (?, ?, 1, ?, ?)
    ON CONFLICT(day_key) DO UPDATE SET
      peak_players = MAX(peak_players, excluded.peak_players),
      sample_count = sample_count + 1,
      player_sum = player_sum + excluded.player_sum,
      updated_at = excluded.updated_at
  `).run(
    dayKey,
    Number(currentPlayers || 0),
    Number(currentPlayers || 0),
    Date.now()
  );

  return db.prepare(`
    SELECT *
    FROM fivem_monitoring_daily
    WHERE day_key = ?
  `).get(dayKey);
}

function recordMonitoringUnique(players) {
  const dayKey = getMonitoringDayKey();
  const now = Date.now();

  const upsert = db.prepare(`
    INSERT INTO fivem_monitoring_unique (
      day_key,
      player_key,
      first_seen_at,
      last_seen_at
    )
    VALUES (?, ?, ?, ?)
    ON CONFLICT(day_key, player_key) DO UPDATE SET
      last_seen_at = excluded.last_seen_at
  `);

  const transaction = db.transaction((list) => {
    for (const player of list) {
      const playerKey = String(
        player?.identifiers?.[0]
        || player?.id
        || player?.name
        || ''
      ).trim();

      if (!playerKey) continue;

      upsert.run(
        dayKey,
        playerKey,
        now,
        now
      );
    }
  });

  transaction(Array.isArray(players) ? players : []);

  const result = db.prepare(`
    SELECT COUNT(*) AS count
    FROM fivem_monitoring_unique
    WHERE day_key = ?
  `).get(dayKey);

  return Number(result?.count || 0);
}

function getMonitoringDaily() {
  return db.prepare(`
    SELECT *
    FROM fivem_monitoring_daily
    WHERE day_key = ?
  `).get(getMonitoringDayKey()) || null;
}

function getMonitoringUniqueCount() {
  const result = db.prepare(`
    SELECT COUNT(*) AS count
    FROM fivem_monitoring_unique
    WHERE day_key = ?
  `).get(getMonitoringDayKey());

  return Number(result?.count || 0);
}

function formatMonitoringDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) {
    return 'Unknown';
  }

  const minutesTotal = Math.floor(ms / 60000);
  const days = Math.floor(minutesTotal / 1440);
  const hours = Math.floor((minutesTotal % 1440) / 60);
  const minutes = minutesTotal % 60;

  const parts = [];

  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);

  return parts.join(' ');
}

function monitoringRelativeTimestamp(timestamp) {
  if (!timestamp) {
    return 'Not detected yet';
  }

  return `<t:${Math.floor(timestamp / 1000)}:R>`;
}

async function getFiveMMonitoringSnapshot(joinCode, directBaseUrl) {
  const startedAt = Date.now();

  try {
    const cfxResult = await fetchCfxServer(joinCode);
    const payload = cfxResult.json;
    const data = payload?.Data || payload?.data || payload;

    if (!data) {
      throw new Error('CFX returned no server data');
    }

    const players = Array.isArray(data.players)
      ? data.players
      : [];

    return {
      online: true,
      players,
      currentPlayers: Number(
        data.clients
        ?? data.Players
        ?? data.playersCount
        ?? players.length
        ?? 0
      ),
      maxPlayers: Number(
        data.svMaxclients
        ?? data.sv_maxclients
        ?? data.maxPlayers
        ?? 0
      ),
      hostname:
        data.hostname
        ?? data.Hostname
        ?? data.projectName
        ?? data.vars?.sv_projectName
        ?? 'San Andreas Life Roleplay',
      gametype:
        data.gametype
        ?? data.GameType
        ?? data.vars?.gametype
        ?? 'Roleplay',
      mapName:
        data.mapname
        ?? data.MapName
        ?? data.vars?.mapname
        ?? 'San Andreas',
      responseTime: Date.now() - startedAt,
      source: cfxResult.source,
    };
  } catch (cfxError) {
    console.error(
      '[FIVEM MONITORING] CFX lookup failed:',
      cfxError?.message || cfxError
    );
  }

  if (directBaseUrl) {
    try {
      const direct = await fetchDirectServer(directBaseUrl);

      return {
        online: true,
        players: direct.players,
        currentPlayers: Number(
          direct.dynamic?.clients
          ?? direct.players.length
          ?? 0
        ),
        maxPlayers: Number(
          direct.dynamic?.sv_maxclients
          ?? 0
        ),
        hostname:
          direct.dynamic?.hostname
          || 'San Andreas Life Roleplay',
        gametype:
          direct.dynamic?.gametype
          || 'Roleplay',
        mapName:
          direct.dynamic?.mapname
          || 'San Andreas',
        responseTime: Date.now() - startedAt,
        source: 'Direct FiveM',
      };
    } catch (directError) {
      console.error(
        '[FIVEM MONITORING] Direct lookup failed:',
        directError?.message || directError
      );
    }
  }

  return {
    online: false,
    players: [],
    currentPlayers: 0,
    maxPlayers: 0,
    hostname: 'San Andreas Life Roleplay',
    gametype: 'Roleplay',
    mapName: 'San Andreas',
    responseTime: Date.now() - startedAt,
    source: 'Unavailable',
  };
}

async function buildMonitoringEmbed(interaction, joinCode, directBaseUrl) {
  const snapshot = await getFiveMMonitoringSnapshot(
    joinCode,
    directBaseUrl
  );

  const state = updateMonitoringState(
    snapshot.online,
    snapshot.currentPlayers
  );

  let daily = getMonitoringDaily();
  let uniqueToday = getMonitoringUniqueCount();

  if (snapshot.online) {
    daily = recordMonitoringDaily(
      snapshot.currentPlayers
    );

    uniqueToday = recordMonitoringUnique(
      snapshot.players
    );
  }

  const todayPeak = Number(
    daily?.peak_players || 0
  );

  const averagePlayers =
    daily?.sample_count
      ? Math.round(
          Number(daily.player_sum || 0)
          / Number(daily.sample_count)
        )
      : 0;

  const percentage =
    snapshot.maxPlayers > 0
      ? Math.round(
          (snapshot.currentPlayers / snapshot.maxPlayers)
          * 100
        )
      : 0;

  const onlineEmoji = getCustomEmoji(
    interaction,
    '1539020608652968016',
    '🟢'
  );

  const offlineEmoji = getCustomEmoji(
    interaction,
    '1539020574737833984',
    '🔴'
  );

  const loadingEmoji = getCustomEmoji(
    interaction,
    '1540486379933278349',
    '🟠'
  );

  const uptime =
    snapshot.online && state.current_online_since
      ? formatMonitoringDuration(
          Date.now() - state.current_online_since
        )
      : 'Offline';

  const embed = new EmbedBuilder()
    .setColor(
      snapshot.online
        ? 0x3498DB
        : 0xED4245
    )
    .setAuthor({
      name: 'San Andreas Life Roleplay',
      iconURL:
        interaction.guild.iconURL({
          extension: 'png',
          size: 128,
        }) || undefined,
    })
    .setTitle('SALRP FiveM Monitoring')
    .setDescription(
      snapshot.online
        ? `${onlineEmoji} **SERVER ONLINE**\nLive monitoring is active.`
        : `${offlineEmoji} **SERVER OFFLINE / UNREACHABLE**\n${loadingEmoji} Waiting for live FiveM data.`
    )
    .addFields(
      {
        name: '👥 Players',
        value:
          snapshot.online
            ? `**${snapshot.currentPlayers} / ${snapshot.maxPlayers || '?'}**\n`
              + `${progressBar(
                snapshot.currentPlayers,
                snapshot.maxPlayers
              )}  **${percentage}%**`
            : '**0 / ?**',
        inline: true,
      },
      {
        name: '⏱️ Uptime',
        value: `**${uptime}**`,
        inline: true,
      },
      {
        name: '📡 Response',
        value: `**${snapshot.responseTime} ms**`,
        inline: true,
      },
      {
        name: '📈 Today’s Peak',
        value:
          `**${todayPeak} / ${snapshot.maxPlayers || '?'}**`,
        inline: true,
      },
      {
        name: '🏆 All-Time Peak',
        value:
          `**${Number(state.all_time_peak || 0)} / ${snapshot.maxPlayers || '?'}**`,
        inline: true,
      },
      {
        name: '👤 Unique Players Today',
        value: `**${uniqueToday}**`,
        inline: true,
      },
      {
        name: '📊 Average Players Today',
        value: `**${averagePlayers}**`,
        inline: true,
      },
      {
        name: '🔄 Last Restart / Recovery',
        value:
          monitoringRelativeTimestamp(
            state.last_recovery_at
          ),
        inline: true,
      },
      {
        name: '🔗 Join Code',
        value: `\`${joinCode}\``,
        inline: true,
      },
      {
        name: '🎮 Server',
        value:
          cleanHostname(snapshot.hostname),
        inline: false,
      },
      {
        name: '🗺️ Map',
        value:
          String(snapshot.mapName).slice(0, 1024),
        inline: true,
      },
      {
        name: '🎭 Gamemode',
        value:
          String(snapshot.gametype).slice(0, 1024),
        inline: true,
      },
      {
        name: '🧭 Data Source',
        value:
          String(snapshot.source).slice(0, 1024),
        inline: true,
      }
    )
    .setThumbnail(
      interaction.guild.iconURL({
        extension: 'png',
        size: 256,
      }) || null
    )
    .setFooter({
      text:
        'SALRP • FiveM Monitoring • Updates every minute',
      iconURL:
        interaction.guild.iconURL({
          extension: 'png',
          size: 64,
        }) || undefined,
    })
    .setTimestamp();

  return embed;
}


const autoStatusTimers = new Map();

function autoStatusEnabled() {
  return ['1', 'true', 'yes', 'on'].includes(
    String(process.env.FIVEM_STATUS_AUTO_UPDATE || 'true').trim().toLowerCase()
  );
}

function getAutoUpdateMs() {
  const minutes = Number(process.env.FIVEM_STATUS_UPDATE_MINUTES || 1);
  return Math.max(1, Number.isFinite(minutes) ? minutes : 1) * 60 * 1000;
}

async function refreshStatusMessage(message, interaction, joinCode, communityUrl, directBaseUrl) {
  const startedAt = Date.now();

  try {
    const cfxResult = await fetchCfxServer(joinCode);
    const payload = cfxResult.json;
    const data = payload?.Data || payload?.data || payload;

    if (!data) throw new Error('CFX returned no server data');

    const players = Array.isArray(data.players) ? data.players : [];
    const currentPlayers = Number(
      data.clients ?? data.Players ?? data.playersCount ?? players.length ?? 0
    );
    const maxPlayers = Number(
      data.svMaxclients ?? data.sv_maxclients ?? data.maxPlayers ?? 0
    );

    const embed = buildOnlineEmbed(interaction, {
      currentPlayers,
      maxPlayers,
      hostname:
        data.hostname ??
        data.Hostname ??
        data.projectName ??
        data.vars?.sv_projectName ??
        'San Andreas Life Roleplay',
      gametype:
        data.gametype ??
        data.GameType ??
        data.vars?.gametype ??
        'Roleplay',
      mapName:
        data.mapname ??
        data.MapName ??
        data.vars?.mapname ??
        'San Andreas',
      endpoint: 'Unavailable',
      responseTime: Date.now() - startedAt,
      joinCode,
      source: cfxResult.source,
      onlineEmoji: getCustomEmoji(interaction, '1539020608652968016', '🟢'),
    });

    await message.edit({
      embeds: [embed],
      components: [buildButtons(joinCode, communityUrl)],
    });
    return;
  } catch (cfxError) {
    console.error('[FIVEM STATUS AUTO] CFX lookup failed:', cfxError?.message || cfxError);
  }

  if (directBaseUrl) {
    try {
      const direct = await fetchDirectServer(directBaseUrl);
      const dynamic = direct.dynamic;
      const players = direct.players;

      const currentPlayers = Number(dynamic?.clients ?? players.length ?? 0);
      const maxPlayers = Number(dynamic?.sv_maxclients ?? 0);

      const embed = buildOnlineEmbed(interaction, {
        currentPlayers,
        maxPlayers,
        hostname: dynamic?.hostname || 'San Andreas Life Roleplay',
        gametype: dynamic?.gametype || 'Roleplay',
        mapName: dynamic?.mapname || 'San Andreas',
        endpoint: 'Unavailable',
        responseTime: Date.now() - startedAt,
        joinCode,
        source: 'Direct FiveM',
        onlineEmoji: getCustomEmoji(interaction, '1539020608652968016', '🟢'),
      });

      await message.edit({
        embeds: [embed],
        components: [buildButtons(joinCode, communityUrl)],
      });
      return;
    } catch (directError) {
      console.error('[FIVEM STATUS AUTO] Direct lookup failed:', directError?.message || directError);
    }
  }

  const loadingEmoji = getCustomEmoji(
    interaction,
    '1540486379933278349',
    '🟠'
  );

  const unavailableEmbed = new EmbedBuilder()
    .setColor(0xFEE75C)
    .setAuthor({
      name: 'San Andreas Life Roleplay',
      iconURL: interaction.guild.iconURL({ extension: 'png', size: 128 }) || undefined,
    })
    .setTitle('FiveM Server Status')
    .setDescription(
      `${loadingEmoji} **LIVE STATUS TEMPORARILY UNAVAILABLE**\n`
      + 'The status provider could not be reached. This does **not** mean the FiveM server is offline.'
    )
    .addFields({
      name: '🔗 Join Code',
      value: `\`${joinCode}\``,
      inline: true,
    })
    .setThumbnail(
      interaction.guild.iconURL({ extension: 'png', size: 256 }) || null
    )
    .setFooter({ text: 'SALRP • FiveM Status • Auto updates every minute' })
    .setTimestamp();

  await message.edit({
    embeds: [unavailableEmbed],
    components: [buildButtons(joinCode, communityUrl)],
  });
}

function startAutoStatus(message, interaction, joinCode, communityUrl, directBaseUrl) {
  if (!autoStatusEnabled()) return;

  const existing = autoStatusTimers.get(message.id);
  if (existing) clearInterval(existing);

  const timer = setInterval(async () => {
    try {
      await refreshStatusMessage(
        message,
        interaction,
        joinCode,
        communityUrl,
        directBaseUrl
      );
    } catch (error) {
      console.error('[FIVEM STATUS AUTO] Update failed:', error);
    }
  }, getAutoUpdateMs());

  timer.unref?.();
  autoStatusTimers.set(message.id, timer);
}




function getMonitoringChannelId() {
  return String(
    process.env.FIVEM_MONITORING_CHANNEL_ID || ''
  ).trim();
}

async function findExistingMonitoringMessage(
  channel,
  clientUserId
) {
  const messages = await channel.messages
    .fetch({ limit: 50 })
    .catch(() => null);

  if (!messages) {
    return null;
  }

  return messages.find((message) => {
    if (message.author?.id !== clientUserId) {
      return false;
    }

    const embed = message.embeds?.[0];

    return (
      embed?.title === 'SALRP FiveM Monitoring'
      && String(
        embed?.footer?.text || ''
      ).includes('SALRP')
    );
  }) || null;
}

async function refreshMonitoringMessage(
  message,
  interaction,
  joinCode,
  communityUrl,
  directBaseUrl
) {
  const embed = await buildMonitoringEmbed(
    interaction,
    joinCode,
    directBaseUrl
  );

  return message.edit({
    embeds: [embed],
    components: [
      buildButtons(
        joinCode,
        communityUrl
      ),
    ],
  });
}

function startMonitoringTimer(
  message,
  interaction,
  joinCode,
  communityUrl,
  directBaseUrl
) {
  const timerKey =
    `monitoring:${message.id}`;

  const existing =
    autoStatusTimers.get(timerKey);

  if (existing) {
    clearInterval(existing);
  }

  const timer = setInterval(
    async () => {
      try {
        await refreshMonitoringMessage(
          message,
          interaction,
          joinCode,
          communityUrl,
          directBaseUrl
        );
      } catch (error) {
        console.error(
          '[FIVEM MONITORING] Update failed:',
          error
        );
      }
    },
    getAutoUpdateMs()
  );

  timer.unref?.();

  autoStatusTimers.set(
    timerKey,
    timer
  );
}

async function ensureMonitoringPost(client) {
  const channelId =
    getMonitoringChannelId();

  if (!channelId) {
    return null;
  }

  const channel =
    client.channels.cache.get(channelId)
    || await client.channels.fetch(channelId).catch(() => null);

  if (!channel?.isTextBased()) {
    console.error(
      `[FIVEM MONITORING] Channel ${channelId} is unavailable or is not text based.`
    );
    return null;
  }

  const joinCode = getJoinCode();

  if (!joinCode) {
    console.error(
      '[FIVEM MONITORING] FIVEM_JOIN_CODE is not configured.'
    );
    return null;
  }

  const communityUrl =
    String(
      process.env.SALRP_COMMUNITY_URL || ''
    ).trim();

  const directBaseUrl =
    cleanBaseUrl(
      process.env.FIVEM_STATUS_BASE_URL
    );

  const fakeInteraction = {
    client,
    guild: channel.guild,
  };

  let message =
    await findExistingMonitoringMessage(
      channel,
      client.user.id
    );

  if (!message) {
    const loadingEmoji =
      getCustomEmoji(
        fakeInteraction,
        '1540486379933278349',
        '🟠'
      );

    message = await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle(
            'SALRP FiveM Monitoring'
          )
          .setDescription(
            `${loadingEmoji} **LOADING LIVE SERVER DATA**`
          )
          .setFooter({
            text:
              'SALRP • FiveM Monitoring • Updates every minute',
          })
          .setTimestamp(),
      ],
    });
  }

  await refreshMonitoringMessage(
    message,
    fakeInteraction,
    joinCode,
    communityUrl,
    directBaseUrl
  );

  startMonitoringTimer(
    message,
    fakeInteraction,
    joinCode,
    communityUrl,
    directBaseUrl
  );

  console.log(
    `[FIVEM MONITORING] Monitoring active in channel ${channelId}.`
  );

  return message;
}


function getAutoPostChannelId() {
  return String(
    process.env.FIVEM_STATUS_AUTOPOST_CHANNEL_ID || ''
  ).trim();
}

async function findExistingStatusMessage(channel, clientUserId) {
  const messages = await channel.messages
    .fetch({ limit: 50 })
    .catch(() => null);

  if (!messages) {
    return null;
  }

  return messages.find((message) => {
    if (message.author?.id !== clientUserId) {
      return false;
    }

    const embed = message.embeds?.[0];

    return (
      embed?.title === 'FiveM Server Status'
      && String(embed?.footer?.text || '').includes('SALRP')
    );
  }) || null;
}

async function createAutoStatusMessage(client, channel) {
  const joinCode = getJoinCode();

  const communityUrl =
    String(
      process.env.SALRP_COMMUNITY_URL || ''
    ).trim();

  const directBaseUrl =
    cleanBaseUrl(
      process.env.FIVEM_STATUS_BASE_URL
    );

  if (!joinCode) {
    throw new Error(
      'FIVEM_JOIN_CODE is not configured.'
    );
  }

  const fakeInteraction = {
    client,
    guild: channel.guild,
  };

  const loadingEmoji = getCustomEmoji(
    fakeInteraction,
    '1540486379933278349',
    '🟠'
  );

  const initialEmbed = new EmbedBuilder()
    .setColor(0xFEE75C)
    .setAuthor({
      name: 'San Andreas Life Roleplay',
      iconURL:
        channel.guild.iconURL({
          extension: 'png',
          size: 128,
        }) || undefined,
    })
    .setTitle('FiveM Server Status')
    .setDescription(
      `${loadingEmoji} **LOADING LIVE STATUS**\n`
      + 'Fetching the latest FiveM server information...'
    )
    .setThumbnail(
      channel.guild.iconURL({
        extension: 'png',
        size: 256,
      }) || null
    )
    .setFooter({
      text: 'SALRP • FiveM Status • Auto updates every minute',
    })
    .setTimestamp();

  const message = await channel.send({
    embeds: [initialEmbed],
    components: [
      buildButtons(
        joinCode,
        communityUrl
      ),
    ],
  });

  await refreshStatusMessage(
    message,
    fakeInteraction,
    joinCode,
    communityUrl,
    directBaseUrl
  );

  startAutoStatus(
    message,
    fakeInteraction,
    joinCode,
    communityUrl,
    directBaseUrl
  );

  return message;
}

async function ensureAutoStatusPost(client) {
  const channelId = getAutoPostChannelId();

  if (!channelId) {
    return null;
  }

  const channel =
    client.channels.cache.get(channelId)
    || await client.channels.fetch(channelId).catch(() => null);

  if (!channel?.isTextBased()) {
    console.error(
      `[FIVEM STATUS] Auto-post channel ${channelId} is unavailable or not text based.`
    );
    return null;
  }

  const existing = await findExistingStatusMessage(
    channel,
    client.user.id
  );

  if (existing) {
    const joinCode = getJoinCode();

    const communityUrl =
      String(
        process.env.SALRP_COMMUNITY_URL || ''
      ).trim();

    const directBaseUrl =
      cleanBaseUrl(
        process.env.FIVEM_STATUS_BASE_URL
      );

    const fakeInteraction = {
      client,
      guild: channel.guild,
    };

    await refreshStatusMessage(
      existing,
      fakeInteraction,
      joinCode,
      communityUrl,
      directBaseUrl
    );

    startAutoStatus(
      existing,
      fakeInteraction,
      joinCode,
      communityUrl,
      directBaseUrl
    );

    console.log(
      `[FIVEM STATUS] Existing auto status message found in ${channelId}.`
    );

    return existing;
  }

  const created = await createAutoStatusMessage(
    client,
    channel
  );

  console.log(
    `[FIVEM STATUS] Auto-posted status message in ${channelId}.`
  );

  return created;
}


module.exports = {
  ensureMonitoringPost,
  ensureAutoStatusPost,
  refreshStatusMessage,
  startAutoStatus,
  data:
    new SlashCommandBuilder()
      .setName('fivemstatus')
      .setDescription(
        'View the live San Andreas Life Roleplay FiveM status.'
      ),

  async execute(interaction) {
    await interaction.deferReply();

    const onlineEmoji = getCustomEmoji(
      interaction,
      '1539020608652968016',
      '🟢'
    );

    const offlineEmoji = getCustomEmoji(
      interaction,
      '1539020574737833984',
      '🔴'
    );

    const loadingEmoji = getCustomEmoji(
      interaction,
      '1540486379933278349',
      '🟠'
    );

    const joinCode =
      getJoinCode();

    const communityUrl =
      String(
        process.env
          .SALRP_COMMUNITY_URL
        || ''
      ).trim();

    const directBaseUrl =
      cleanBaseUrl(
        process.env
          .FIVEM_STATUS_BASE_URL
      );

    if (!joinCode) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle(
              'FiveM Status Configuration Error'
            )
            .setDescription(
              '`FIVEM_JOIN_CODE` is not configured in the bot `.env`.'
            ),
        ],
      });
    }

    const startedAt = Date.now();

    let cfxResult = null;
    let cfxError = null;

    try {
      cfxResult =
        await fetchCfxServer(
          joinCode
        );
    } catch (error) {
      cfxError = error;

      console.error(
        '[FIVEM STATUS] CFX lookup failed:',
        error
      );
    }

    if (cfxResult) {
      try {
        const payload =
          cfxResult.json;

        const data =
          payload?.Data
          || payload?.data
          || payload;

        if (!data) {
          throw new Error(
            'CFX returned no server data'
          );
        }

        const players =
          Array.isArray(data.players)
            ? data.players
            : [];

        const currentPlayers =
          Number(
            data.clients
            ?? data.Players
            ?? data.playersCount
            ?? players.length
            ?? 0
          );

        const maxPlayers =
          Number(
            data.svMaxclients
            ?? data.sv_maxclients
            ?? data.maxPlayers
            ?? 0
          );

        const hostname =
          data.hostname
          ?? data.Hostname
          ?? data.projectName
          ?? data.vars?.sv_projectName
          ?? 'San Andreas Life Roleplay';

        const gametype =
          data.gametype
          ?? data.GameType
          ?? data.vars?.gametype
          ?? 'Roleplay';

        const mapName =
          data.mapname
          ?? data.MapName
          ?? data.vars?.mapname
          ?? 'San Andreas';

        const endpoint =
          data.connectEndPoints?.[0]
          ?? data.connectEndpoints?.[0]
          ?? data.connectEndpoint
          ?? data.EndPoint
          ?? data.endpoint
          ?? 'Unavailable';

        const embed =
          buildOnlineEmbed(
            interaction,
            {
              currentPlayers,
              maxPlayers,
              hostname,
              gametype,
              mapName,
              endpoint,
              responseTime:
                Date.now()
                - startedAt,
              joinCode,
              source:
                cfxResult.source,
              onlineEmoji,
            }
          );

        const statusMessage = await interaction.editReply({
          embeds: [embed],
          components: [
            buildButtons(
              joinCode,
              communityUrl
            ),
          ],
        });

        startAutoStatus(
          statusMessage,
          interaction,
          joinCode,
          communityUrl,
          directBaseUrl
        );

        return statusMessage;
      } catch (renderError) {
        console.error(
          '[FIVEM STATUS] CFX data/render error:',
          renderError
        );
      }
    }

    if (directBaseUrl) {
      try {
        const direct =
          await fetchDirectServer(
            directBaseUrl
          );

        const dynamic =
          direct.dynamic;

        const players =
          direct.players;

        const currentPlayers =
          Number(
            dynamic?.clients
            ?? players.length
            ?? 0
          );

        const maxPlayers =
          Number(
            dynamic?.sv_maxclients
            ?? 0
          );

        const embed =
          buildOnlineEmbed(
            interaction,
            {
              currentPlayers,
              maxPlayers,
              hostname:
                dynamic?.hostname
                || 'San Andreas Life Roleplay',
              gametype:
                dynamic?.gametype
                || 'Roleplay',
              mapName:
                dynamic?.mapname
                || 'San Andreas',
              endpoint:
                directBaseUrl,
              responseTime:
                Date.now()
                - startedAt,
              joinCode,
              source:
                'Direct FiveM',
              onlineEmoji,
            }
          );

        const statusMessage = await interaction.editReply({
          embeds: [embed],
          components: [
            buildButtons(
              joinCode,
              communityUrl
            ),
          ],
        });

        startAutoStatus(
          statusMessage,
          interaction,
          joinCode,
          communityUrl,
          directBaseUrl
        );

        return statusMessage;
      } catch (directError) {
        console.error(
          '[FIVEM STATUS] Direct lookup also failed:',
          directError
        );
      }
    }

    const embed =
      new EmbedBuilder()
        .setColor(0xFEE75C)
        .setAuthor({
          name:
            'San Andreas Life Roleplay',
          iconURL:
            interaction.guild.iconURL({
              extension: 'png',
              size: 128,
            }) || undefined,
        })
        .setTitle(
          'FiveM Server Status'
        )
        .setDescription(
          `${loadingEmoji} **LIVE STATUS TEMPORARILY UNAVAILABLE**\n`
          + 'The status provider could not be reached. '
          + 'This does **not** mean the FiveM server is offline.'
        )
        .addFields(
          {
            name: '🎮 Connect',
            value:
              `The server can still be joined using \`${joinCode}\`.`,
            inline: false,
          },
          {
            name: '🔗 Join Code',
            value:
              `\`${joinCode}\``,
            inline: true,
          }
        )
        .setThumbnail(
          interaction.guild.iconURL({
            extension: 'png',
            size: 256,
          }) || null
        )
        .setFooter({
          text:
            'SALRP • FiveM Status',
        })
        .setTimestamp();

    const statusMessage = await interaction.editReply({
      embeds: [embed],
      components: [
        buildButtons(
          joinCode,
          communityUrl
        ),
      ],
    });

    startAutoStatus(
      statusMessage,
      interaction,
      joinCode,
      communityUrl,
      directBaseUrl
    );

    return statusMessage;
  },
};
