/**
 * Security & Authentication Module
 * Native PBKDF2/scrypt password hashing and HMAC-SHA256 session token management.
 */

const crypto = require('node:crypto');
const config = require('../../config');
const { queryOne, execute } = require('../db/database');

const SALT_BYTES = 16;
const KEY_BYTES = 64;
const ITERATIONS = 100000;
const DIGEST = 'sha512';

/**
 * Hash a password securely with PBKDF2
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
  const derivedKey = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_BYTES, DIGEST).toString('hex');
  return `${salt}:${derivedKey}`;
}

/**
 * Verify a plain password against stored salt:hash
 */
function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  const derivedKey = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_BYTES, DIGEST).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(derivedKey, 'hex'), Buffer.from(key, 'hex'));
}

/**
 * Generate a signed session token
 */
function createSessionToken(adminUser) {
  const payload = {
    userId: adminUser.id,
    username: adminUser.username,
    role: adminUser.role,
    exp: Date.now() + 1000 * 60 * 60 * 24, // 24 hours
    nonce: crypto.randomBytes(8).toString('hex'),
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', config.admin.sessionSecret)
    .update(payloadBase64)
    .digest('base64url');

  return `${payloadBase64}.${signature}`;
}

/**
 * Verify session token and return user if valid
 */
function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadBase64, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', config.admin.sessionSecret)
    .update(payloadBase64)
    .digest('base64url');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
    if (Date.now() > payload.exp) {
      return null;
    }
    // Verify admin exists and is still active
    const admin = queryOne('SELECT id, username, full_name, role, is_active FROM admin_users WHERE id = ?', [payload.userId]);
    if (!admin || !admin.is_active) {
      return null;
    }
    return admin;
  } catch (_) {
    return null;
  }
}

/**
 * Ensure default admin user exists
 */
function ensureDefaultAdmin() {
  const existing = queryOne('SELECT id FROM admin_users WHERE username = ?', [config.admin.username]);
  if (!existing) {
    const passwordHash = hashPassword(config.admin.password);
    const now = new Date().toISOString();
    execute(
      `INSERT INTO admin_users (username, password_hash, full_name, role, is_active, created_at)
       VALUES (?, ?, ?, 'SUPER_ADMIN', 1, ?)`,
      [config.admin.username, passwordHash, 'Khmer Help Khmer Super Admin', now]
    );
    console.log(`[Auth] Default admin created: ${config.admin.username}`);
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  ensureDefaultAdmin,
};
