const db = require('../database/database');

db.exec(`
  CREATE TABLE IF NOT EXISTS maintenance_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    enabled INTEGER NOT NULL DEFAULT 0,
    enabled_by TEXT,
    enabled_at INTEGER
  );
`);

function getMaintenanceState() {
  return db.prepare(`
    SELECT enabled, enabled_by, enabled_at
    FROM maintenance_state
    WHERE id = 1
  `).get() || {
    enabled: 0,
    enabled_by: null,
    enabled_at: null,
  };
}

function setMaintenance(enabled, userId) {
  db.prepare(`
    INSERT OR REPLACE INTO maintenance_state (
      id,
      enabled,
      enabled_by,
      enabled_at
    )
    VALUES (1, ?, ?, ?)
  `).run(
    enabled ? 1 : 0,
    enabled ? userId : null,
    enabled ? Date.now() : null
  );
}

module.exports = {
  getMaintenanceState,
  setMaintenance,
};
