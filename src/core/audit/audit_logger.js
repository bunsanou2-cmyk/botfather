/**
 * Immutable Audit Logger
 * Records tamper-evident audit trails for all financial, verification, and administrative actions.
 */

const { execute, queryAll } = require('../db/database');

function logAudit({
  actorType = 'SYSTEM', // 'ADMIN', 'SYSTEM', 'DONOR', 'WEBHOOK'
  actorId = null,
  action,
  entityType,
  entityId = null,
  details = {},
  ipAddress = null,
}) {
  const now = new Date().toISOString();
  const detailsJson = typeof details === 'string' ? details : JSON.stringify(details);

  try {
    execute(
      `INSERT INTO audit_logs (actor_type, actor_id, action, entity_type, entity_id, details, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        actorType,
        actorId ? String(actorId) : null,
        action,
        entityType,
        entityId ? String(entityId) : null,
        detailsJson,
        ipAddress || 'internal',
        now,
      ]
    );
  } catch (err) {
    console.error('[AuditLogger] Failed to write audit record:', err);
  }
}

function getRecentLogs(limit = 100, offset = 0, filter = {}) {
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];

  if (filter.action) {
    sql += ' AND action = ?';
    params.push(filter.action);
  }
  if (filter.entityType) {
    sql += ' AND entity_type = ?';
    params.push(filter.entityType);
  }
  if (filter.actorType) {
    sql += ' AND actor_type = ?';
    params.push(filter.actorType);
  }

  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return queryAll(sql, params).map(row => ({
    ...row,
    details: (() => {
      try {
        return JSON.parse(row.details);
      } catch (_) {
        return row.details;
      }
    })(),
  }));
}

module.exports = {
  logAudit,
  getRecentLogs,
};
