/**
 * Admin Authentication Controller
 */

const { queryOne } = require('../../core/db/database');
const { verifyPassword, createSessionToken, verifySessionToken } = require('../../core/security/auth');
const { logAudit } = require('../../core/audit/audit_logger');
const { parseJsonBody, sendJson } = require('../router');

async function handleLogin(req, res) {
  try {
    const body = await parseJsonBody(req);
    const { username, password } = body;

    if (!username || !password) {
      return sendJson(res, 400, { success: false, error: 'Username and password are required' });
    }

    const admin = queryOne('SELECT * FROM admin_users WHERE username = ?', [username]);
    if (!admin || !admin.is_active) {
      return sendJson(res, 401, { success: false, error: 'Invalid credentials or inactive account' });
    }

    const isMatch = verifyPassword(password, admin.password_hash);
    if (!isMatch) {
      return sendJson(res, 401, { success: false, error: 'Invalid credentials' });
    }

    const token = createSessionToken(admin);

    logAudit({
      actorType: 'ADMIN',
      actorId: String(admin.id),
      action: 'ADMIN_LOGIN',
      entityType: 'admin_users',
      entityId: admin.id,
      details: { username: admin.username, role: admin.role },
      ipAddress: req.socket.remoteAddress,
    });

    return sendJson(res, 200, {
      success: true,
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        fullName: admin.full_name,
        role: admin.role,
      },
    });
  } catch (err) {
    return sendJson(res, 500, { success: false, error: err.message });
  }
}

async function handleGetMe(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const admin = verifySessionToken(token);

  if (!admin) {
    return sendJson(res, 401, { success: false, error: 'Unauthorized or session expired' });
  }

  return sendJson(res, 200, {
    success: true,
    admin: {
      id: admin.id,
      username: admin.username,
      fullName: admin.full_name,
      role: admin.role,
    },
  });
}

/**
 * Authentication middleware helper
 */
function requireAdminAuth(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const admin = verifySessionToken(token);
  if (!admin) {
    sendJson(res, 401, { success: false, error: 'Unauthorized. Please sign in.' });
    return null;
  }
  return admin;
}

module.exports = {
  handleLogin,
  handleGetMe,
  requireAdminAuth,
};
