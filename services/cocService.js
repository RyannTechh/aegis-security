const db = require('../database/database');

const COC_RANKS = Object.freeze([
  {
    key: 'owner',
    name: 'Owner',
    order: 1,
    color: 0xF1C40F,
    callsigns: ['101', '102'],
  },
  {
    key: 'co_owner',
    name: 'Co-Owner',
    order: 2,
    color: 0xE67E22,
    callsigns: ['103', '104'],
  },
  {
    key: 'general_manager',
    name: 'General Manager',
    order: 3,
    color: 0xE91E63,
    callsigns: ['105', '106', '107'],
  },
  {
    key: 'executive_management',
    name: 'Executive Management',
    order: 4,
    color: 0xE74C3C,
    callsigns: ['108', '109', '110'],
  },
  {
    key: 'senior_management',
    name: 'Senior Management',
    order: 5,
    color: 0x9B59B6,
    callsigns: ['111', '112', '113', '114', '115'],
  },
  {
    key: 'management',
    name: 'Management',
    order: 6,
    color: 0x3498DB,
    callsigns: ['116', '117', '118', '119', '120'],
  },
  {
    key: 'junior_management',
    name: 'Junior Management',
    order: 7,
    color: 0x1ABC9C,
    callsigns: ['121', '122', '123', '124', '125'],
  },
  {
    key: 'trial_management',
    name: 'Trial Management',
    order: 8,
    color: 0x2ECC71,
    callsigns: ['126', '127', '128', '129', '130'],
  },
  {
    key: 'community_management',
    name: 'Community Management',
    order: 9,
    color: 0x95A5A6,
    callsigns: ['131', '132', '133', '134', '135'],
  },
]);

db.exec(`
  CREATE TABLE IF NOT EXISTS coc_rank_members (
    guild_id TEXT NOT NULL,
    rank_key TEXT NOT NULL,
    user_id TEXT NOT NULL,
    callsign TEXT,
    updated_by TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, rank_key, user_id)
  );

  CREATE TABLE IF NOT EXISTS coc_assistants (
    guild_id TEXT NOT NULL,
    management_user_id TEXT NOT NULL,
    assistant_user_id TEXT NOT NULL,
    added_by TEXT NOT NULL,
    added_at INTEGER NOT NULL,
    PRIMARY KEY (
      guild_id,
      management_user_id,
      assistant_user_id
    )
  );
`);

const cocColumns = db.prepare(`
  PRAGMA table_info(coc_rank_members)
`).all();

if (!cocColumns.some((column) => column.name === 'callsign')) {
  db.exec(`
    ALTER TABLE coc_rank_members
    ADD COLUMN callsign TEXT
  `);
}

const oldTableExists = db.prepare(`
  SELECT 1
  FROM sqlite_master
  WHERE type = 'table'
    AND name = 'coc_members'
`).get();

if (oldTableExists) {
  const oldRows = db.prepare(`
    SELECT guild_id, rank_key, user_id, updated_by, updated_at
    FROM coc_members
  `).all();

  const migrate = db.prepare(`
    INSERT OR IGNORE INTO coc_rank_members (
      guild_id,
      rank_key,
      user_id,
      callsign,
      updated_by,
      updated_at
    )
    VALUES (?, ?, ?, NULL, ?, ?)
  `);

  const transaction = db.transaction((rows) => {
    for (const row of rows) {
      migrate.run(
        row.guild_id,
        row.rank_key,
        row.user_id,
        row.updated_by,
        row.updated_at
      );
    }
  });

  transaction(oldRows);
}

function getRank(rankKey) {
  return COC_RANKS.find((rank) => rank.key === rankKey) || null;
}

function getRankMembers(guildId, rankKey) {
  return db.prepare(`
    SELECT *
    FROM coc_rank_members
    WHERE guild_id = ?
      AND rank_key = ?
    ORDER BY CAST(callsign AS INTEGER) ASC, updated_at ASC
  `).all(guildId, rankKey);
}

function getNextAvailableCallsign(guildId, rankKey) {
  const rank = getRank(rankKey);

  if (!rank) {
    throw new Error('Invalid chain-of-command rank.');
  }

  const usedCallsigns = new Set(
    getRankMembers(guildId, rankKey)
      .map((member) => member.callsign)
      .filter(Boolean)
  );

  return rank.callsigns.find(
    (callsign) => !usedCallsigns.has(callsign)
  ) || null;
}

function backfillMissingCallsigns(guildId, rankKey) {
  const rank = getRank(rankKey);

  if (!rank) {
    return;
  }

  const members = getRankMembers(guildId, rankKey);
  const used = new Set(
    members.map((member) => member.callsign).filter(Boolean)
  );

  const update = db.prepare(`
    UPDATE coc_rank_members
    SET callsign = ?
    WHERE guild_id = ?
      AND rank_key = ?
      AND user_id = ?
  `);

  for (const member of members) {
    if (member.callsign) {
      continue;
    }

    const available = rank.callsigns.find(
      (callsign) => !used.has(callsign)
    );

    if (!available) {
      break;
    }

    update.run(
      available,
      guildId,
      rankKey,
      member.user_id
    );

    used.add(available);
  }
}

function backfillAllCallsigns(guildId) {
  for (const rank of COC_RANKS) {
    backfillMissingCallsigns(guildId, rank.key);
  }
}

function addRankMember(guildId, rankKey, userId, updatedBy) {
  const rank = getRank(rankKey);

  if (!rank) {
    throw new Error('Invalid chain-of-command rank.');
  }

  backfillMissingCallsigns(guildId, rankKey);

  const existing = db.prepare(`
    SELECT *
    FROM coc_rank_members
    WHERE guild_id = ?
      AND rank_key = ?
      AND user_id = ?
  `).get(guildId, rankKey, userId);

  if (existing) {
    return {
      added: false,
      callsign: existing.callsign,
      reason: 'already_assigned',
    };
  }

  const callsign = getNextAvailableCallsign(guildId, rankKey);

  if (!callsign) {
    return {
      added: false,
      callsign: null,
      reason: 'rank_full',
    };
  }

  db.prepare(`
    INSERT INTO coc_rank_members (
      guild_id,
      rank_key,
      user_id,
      callsign,
      updated_by,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    guildId,
    rankKey,
    userId,
    callsign,
    updatedBy,
    Date.now()
  );

  return {
    added: true,
    callsign,
    reason: null,
  };
}

function setRankMember(guildId, rankKey, userId, updatedBy) {
  return addRankMember(
    guildId,
    rankKey,
    userId,
    updatedBy
  );
}

function removeRankMember(guildId, rankKey, userId) {
  const transaction = db.transaction(() => {
    const removed = db.prepare(`
      DELETE FROM coc_rank_members
      WHERE guild_id = ?
        AND rank_key = ?
        AND user_id = ?
    `).run(
      guildId,
      rankKey,
      userId
    ).changes;

    if (removed > 0) {
      db.prepare(`
        DELETE FROM coc_assistants
        WHERE guild_id = ?
          AND management_user_id = ?
      `).run(
        guildId,
        userId
      );
    }

    return removed;
  });

  return transaction();
}

function getRankMember(guildId, rankKey) {
  backfillMissingCallsigns(guildId, rankKey);

  return db.prepare(`
    SELECT *
    FROM coc_rank_members
    WHERE guild_id = ?
      AND rank_key = ?
    ORDER BY CAST(callsign AS INTEGER) ASC, updated_at ASC
    LIMIT 1
  `).get(guildId, rankKey);
}

function getAllRankMembers(guildId) {
  backfillAllCallsigns(guildId);

  const rows = db.prepare(`
    SELECT *
    FROM coc_rank_members
    WHERE guild_id = ?
    ORDER BY CAST(callsign AS INTEGER) ASC, updated_at ASC
  `).all(guildId);

  const grouped = new Map();

  for (const row of rows) {
    if (!grouped.has(row.rank_key)) {
      grouped.set(row.rank_key, []);
    }

    grouped.get(row.rank_key).push(row);
  }

  return grouped;
}

function addAssistant(
  guildId,
  managementUserId,
  assistantUserId,
  addedBy
) {
  db.prepare(`
    INSERT OR REPLACE INTO coc_assistants (
      guild_id,
      management_user_id,
      assistant_user_id,
      added_by,
      added_at
    )
    VALUES (?, ?, ?, ?, ?)
  `).run(
    guildId,
    managementUserId,
    assistantUserId,
    addedBy,
    Date.now()
  );
}

function getAssistants(guildId, managementUserId) {
  return db.prepare(`
    SELECT *
    FROM coc_assistants
    WHERE guild_id = ?
      AND management_user_id = ?
    ORDER BY added_at ASC
  `).all(guildId, managementUserId);
}

function isConfiguredManagementUser(guildId, userId) {
  return Boolean(
    db.prepare(`
      SELECT 1
      FROM coc_rank_members
      WHERE guild_id = ?
        AND user_id = ?
      LIMIT 1
    `).get(guildId, userId)
  );
}

module.exports = {
  COC_RANKS,
  getRank,
  getNextAvailableCallsign,
  addRankMember,
  setRankMember,
  removeRankMember,
  getRankMember,
  getRankMembers,
  getAllRankMembers,
  addAssistant,
  getAssistants,
  isConfiguredManagementUser,
};
