const db = require('../database/database');

/*
 * Tracks target roles that were actually granted by the donator-bundle system.
 * Manually assigned target roles are never removed by bundle sync.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS donator_bundle_grants (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    target_role_id TEXT NOT NULL,
    granted_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, user_id, target_role_id)
  );
`);

function listBundles(guildId) {
  return db.prepare(`
    SELECT source_role_id, target_role_id
    FROM donator_bundles
    WHERE guild_id = ?
    ORDER BY target_role_id, source_role_id
  `).all(guildId);
}

function addBundle(
  guildId,
  sourceRoleId,
  targetRoleId,
  userId
) {
  db.prepare(`
    INSERT OR REPLACE INTO donator_bundles
    (
      guild_id,
      source_role_id,
      target_role_id,
      created_by,
      created_at
    )
    VALUES (?, ?, ?, ?, ?)
  `).run(
    guildId,
    sourceRoleId,
    targetRoleId,
    userId,
    Date.now()
  );
}

function removeBundle(
  guildId,
  sourceRoleId,
  targetRoleId
) {
  return db.prepare(`
    DELETE FROM donator_bundles
    WHERE guild_id = ?
      AND source_role_id = ?
      AND target_role_id = ?
  `).run(
    guildId,
    sourceRoleId,
    targetRoleId
  ).changes;
}

function groupBundlesByTarget(rows) {
  const grouped = new Map();

  for (const row of rows) {
    if (!grouped.has(row.target_role_id)) {
      grouped.set(
        row.target_role_id,
        new Set()
      );
    }

    grouped
      .get(row.target_role_id)
      .add(row.source_role_id);
  }

  return grouped;
}

function getBundleGrantRows(
  guildId,
  userId
) {
  return db.prepare(`
    SELECT target_role_id
    FROM donator_bundle_grants
    WHERE guild_id = ?
      AND user_id = ?
  `).all(
    guildId,
    userId
  );
}

function markBundleGrants(
  guildId,
  userId,
  targetRoleIds
) {
  if (!targetRoleIds.length) {
    return;
  }

  const insert = db.prepare(`
    INSERT OR REPLACE INTO donator_bundle_grants
    (
      guild_id,
      user_id,
      target_role_id,
      granted_at
    )
    VALUES (?, ?, ?, ?)
  `);

  const transaction = db.transaction((roleIds) => {
    const now = Date.now();

    for (const roleId of roleIds) {
      insert.run(
        guildId,
        userId,
        roleId,
        now
      );
    }
  });

  transaction(targetRoleIds);
}

function clearBundleGrants(
  guildId,
  userId,
  targetRoleIds
) {
  if (!targetRoleIds.length) {
    return;
  }

  const remove = db.prepare(`
    DELETE FROM donator_bundle_grants
    WHERE guild_id = ?
      AND user_id = ?
      AND target_role_id = ?
  `);

  const transaction = db.transaction((roleIds) => {
    for (const roleId of roleIds) {
      remove.run(
        guildId,
        userId,
        roleId
      );
    }
  });

  transaction(targetRoleIds);
}

async function syncMember(member) {
  const rows = listBundles(
    member.guild.id
  );

  if (!rows.length) {
    return {
      added: 0,
      removed: 0,
    };
  }

  const groupedBundles =
    groupBundlesByTarget(rows);

  const bundleGrantRows =
    getBundleGrantRows(
      member.guild.id,
      member.id
    );

  const bundleGrantedRoleIds =
    new Set(
      bundleGrantRows.map(
        (row) => row.target_role_id
      )
    );

  const rolesToAdd = [];
  const rolesToRemove = [];
  const grantsToClean = [];

  for (
    const [
      targetRoleId,
      sourceRoleIds,
    ] of groupedBundles.entries()
  ) {
    const targetRole =
      member.guild.roles.cache.get(
        targetRoleId
      );

    if (
      !targetRole
      || !targetRole.editable
      || targetRole.managed
    ) {
      continue;
    }

    const hasAnySourceRole =
      [...sourceRoleIds].some(
        (sourceRoleId) =>
          member.roles.cache.has(
            sourceRoleId
          )
      );

    const hasTargetRole =
      member.roles.cache.has(
        targetRoleId
      );

    const bundleGranted =
      bundleGrantedRoleIds.has(
        targetRoleId
      );

    /*
     * SOURCE PRESENT + TARGET MISSING:
     * Queue for one batched role-add request.
     */
    if (
      hasAnySourceRole
      && !hasTargetRole
    ) {
      rolesToAdd.push(targetRole);
      continue;
    }

    /*
     * NO SOURCE + TARGET PRESENT + BUNDLE OWNS IT:
     * Queue for one batched role-remove request.
     */
    if (
      !hasAnySourceRole
      && hasTargetRole
      && bundleGranted
    ) {
      rolesToRemove.push(targetRole);
      continue;
    }

    /*
     * Stale DB tracking cleanup.
     */
    if (
      !hasAnySourceRole
      && !hasTargetRole
      && bundleGranted
    ) {
      grantsToClean.push(targetRoleId);
    }
  }

  if (grantsToClean.length) {
    clearBundleGrants(
      member.guild.id,
      member.id,
      grantsToClean
    );
  }

  let added = 0;
  let removed = 0;

  /*
   * FAST PATH:
   * Add every missing bundle target in one Discord API call.
   */
  if (rolesToAdd.length > 0) {
    try {
      await member.roles.add(
        rolesToAdd,
        'Donator bundle synchronization'
      );

      const addedRoleIds =
        rolesToAdd.map(
          (role) => role.id
        );

      markBundleGrants(
        member.guild.id,
        member.id,
        addedRoleIds
      );

      added = rolesToAdd.length;
    } catch (error) {
      console.error(
        `[DONATOR BUNDLE] Failed batched role add for `
        + `${member.user.tag} (${member.id}):`,
        error
      );
    }
  }

  /*
   * FAST PATH:
   * Remove every bundle-owned target in one Discord API call.
   */
  if (rolesToRemove.length > 0) {
    try {
      await member.roles.remove(
        rolesToRemove,
        'Donator bundle synchronization'
      );

      const removedRoleIds =
        rolesToRemove.map(
          (role) => role.id
        );

      clearBundleGrants(
        member.guild.id,
        member.id,
        removedRoleIds
      );

      removed = rolesToRemove.length;
    } catch (error) {
      console.error(
        `[DONATOR BUNDLE] Failed batched role removal for `
        + `${member.user.tag} (${member.id}):`,
        error
      );
    }
  }

  return {
    added,
    removed,
  };
}

module.exports = {
  listBundles,
  addBundle,
  removeBundle,
  groupBundlesByTarget,
  getBundleGrantRows,
  markBundleGrants,
  clearBundleGrants,
  syncMember,
};
