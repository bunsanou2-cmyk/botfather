/**
 * Database Module
 * Uses Node.js native DatabaseSync (node:sqlite) with WAL mode, foreign keys, and transactions.
 */

const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../../config');

let dbInstance = null;

function getDb(dbPath = config.db.path) {
  if (dbInstance) return dbInstance;

  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new DatabaseSync(dbPath);

  // Performance and integrity pragma settings
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');

  dbInstance = db;
  return db;
}

function initDb(dbPath = config.db.path) {
  const db = getDb(dbPath);
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
  return db;
}

/**
 * Execute query and return all matching rows
 */
function queryAll(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}

/**
 * Execute query and return single matching row or null
 */
function queryOne(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  const result = stmt.get(...params);
  return result || null;
}

/**
 * Execute insert/update/delete statement and return metadata
 */
function execute(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}

/**
 * Run operations within a transaction
 */
function transaction(fn) {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE TRANSACTION;');
  try {
    const result = fn(db);
    db.exec('COMMIT;');
    return result;
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
}

/**
 * Close database connection (for testing or shutdown)
 */
function closeDb() {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (_) {}
    dbInstance = null;
  }
}

module.exports = {
  getDb,
  initDb,
  queryAll,
  queryOne,
  execute,
  transaction,
  closeDb,
};
