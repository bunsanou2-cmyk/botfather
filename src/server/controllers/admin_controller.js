/**
 * Admin Dashboard Controller
 * Implements dashboard metrics, beneficiary verification workflow,
 * financial donation audits, separate distribution management, and broadcasts.
 */

const { queryOne, queryAll, execute, transaction } = require('../../core/db/database');
const { requireAdminAuth } = require('./auth_controller');
const { logAudit, getRecentLogs } = require('../../core/audit/audit_logger');
const { parseJsonBody, sendJson } = require('../router');
const { isValidCategory, isValidBeneficiaryStatus, VALID_DISTRIBUTION_STATUSES } = require('../../core/security/validator');
const botService = require('../../bot/bot_service');

async function handleDashboardStats(req, res) {
  const admin = requireAdminAuth(req, res);
  if (!admin) return;

  const totalDonations = queryOne("SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM donations WHERE status = 'PAID'");
  const activeCampaigns = queryOne("SELECT COUNT(*) as count FROM campaigns WHERE status = 'ACTIVE'");
  const completedCampaigns = queryOne("SELECT COUNT(*) as count FROM campaigns WHERE status IN ('TARGET_REACHED', 'COMPLETED')");
  const totalDonors = queryOne('SELECT COUNT(*) as count FROM users');
  const pendingVerification = queryOne("SELECT COUNT(*) as count FROM beneficiaries WHERE status = 'PENDING_REVIEW'");
  const pendingDistributions = queryOne("SELECT COUNT(*) as count FROM distributions WHERE status IN ('PENDING', 'PROCESSING')");
  const totalDistributed = queryOne("SELECT COALESCE(SUM(amount), 0) as total FROM distributions WHERE status = 'DISTRIBUTED'");

  // Recent 6 donations
  const recentDonations = queryAll(
    `SELECT d.*, b.full_name as beneficiary_name
     FROM donations d
     LEFT JOIN beneficiaries b ON d.beneficiary_id = b.id
     ORDER BY d.id DESC LIMIT 6`
  );

  // Category breakdown
  const categoryStats = queryAll(
    `SELECT category, COUNT(*) as count, COALESCE(SUM(amount_received), 0) as total_received
     FROM beneficiaries
     GROUP BY category`
  );

  sendJson(res, 200, {
    success: true,
    stats: {
      totalDonationsCount: totalDonations.count,
      totalDonatedAmount: totalDonations.total,
      totalDistributedAmount: totalDistributed.total,
      activeCampaigns: activeCampaigns.count,
      completedCampaigns: completedCampaigns.count,
      totalDonors: totalDonors.count,
      pendingVerification: pendingVerification.count,
      pendingDistributions: pendingDistributions.count,
    },
    recentDonations,
    categoryStats,
  });
}

async function handleGetBeneficiaries(req, res) {
  const admin = requireAdminAuth(req, res);
  if (!admin) return;

  const { status, category, search } = req.query || {};
  let sql = 'SELECT * FROM beneficiaries WHERE 1=1';
  const params = [];

  if (status && status !== 'ALL') {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (category && category !== 'ALL') {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (search) {
    sql += ' AND (full_name LIKE ? OR location LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += ' ORDER BY id DESC';
  const list = queryAll(sql, params);

  sendJson(res, 200, { success: true, beneficiaries: list });
}

async function handleCreateBeneficiary(req, res) {
  const admin = requireAdminAuth(req, res);
  if (!admin) return;

  try {
    const body = await parseJsonBody(req);
    const {
      fullName,
      fullNameKm,
      age,
      gender,
      location,
      locationKm,
      category,
      profileImageUrl,
      currentSituation,
      currentSituationKm,
      shortDescription,
      shortDescriptionKm,
      story,
      storyKm,
      amountNeeded,
      supportingDocuments,
      contactInfo,
      verificationNotes,
      initialStatus = 'DRAFT',
    } = body;

    if (!fullName || !category || !amountNeeded || !location || !currentSituation || !story) {
      return sendJson(res, 400, { success: false, error: 'Missing required beneficiary fields' });
    }

    if (!isValidCategory(category)) {
      return sendJson(res, 400, { success: false, error: 'Invalid beneficiary category' });
    }

    const cleanNeeded = parseFloat(amountNeeded);
    if (isNaN(cleanNeeded) || cleanNeeded <= 0) {
      return sendJson(res, 400, { success: false, error: 'Target amount must be a positive number' });
    }

    const now = new Date().toISOString();
    let beneficiaryId;

    transaction(() => {
      execute(
        `INSERT INTO beneficiaries (
          category, full_name, full_name_km, age, gender, location, location_km,
          profile_image_url, current_situation, current_situation_km,
          short_description, short_description_km, story, story_km,
          amount_needed, amount_received, status, verification_badge,
          verification_notes, supporting_documents, contact_info,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.0, ?, 0, ?, ?, ?, ?, ?)`,
        [
          category,
          fullName,
          fullNameKm || fullName,
          age ? parseInt(age, 10) : null,
          gender || 'Other',
          location,
          locationKm || location,
          profileImageUrl || null,
          currentSituation,
          currentSituationKm || currentSituation,
          shortDescription || null,
          shortDescriptionKm || shortDescription || null,
          story,
          storyKm || story,
          cleanNeeded,
          initialStatus,
          verificationNotes || null,
          supportingDocuments ? JSON.stringify(supportingDocuments) : null,
          contactInfo || null,
          now,
          now,
        ]
      );

      const created = queryOne('SELECT id FROM beneficiaries ORDER BY id DESC LIMIT 1');
      beneficiaryId = created.id;

      // Automatically initialize fundraising campaign
      execute(
        `INSERT INTO campaigns (
          beneficiary_id, title, title_km, target_amount, current_amount,
          status, start_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 0.0, 'ACTIVE', ?, ?, ?)`,
        [
          beneficiaryId,
          `Help ${fullName}`,
          `ជួយឧបត្ថម្ភ ${fullNameKm || fullName}`,
          cleanNeeded,
          now,
          now,
          now,
        ]
      );
    });

    logAudit({
      actorType: 'ADMIN',
      actorId: String(admin.id),
      action: 'BENEFICIARY_CREATED',
      entityType: 'beneficiary',
      entityId: beneficiaryId,
      details: { fullName, category, amountNeeded: cleanNeeded, status: initialStatus },
      ipAddress: req.socket.remoteAddress,
    });

    sendJson(res, 201, { success: true, beneficiaryId });
  } catch (err) {
    sendJson(res, 500, { success: false, error: err.message });
  }
}

async function handleUpdateBeneficiaryStatus(req, res) {
  const admin = requireAdminAuth(req, res);
  if (!admin) return;

  const id = parseInt(req.params.id, 10);
  try {
    const body = await parseJsonBody(req);
    const { status, notes } = body;

    if (!isValidBeneficiaryStatus(status)) {
      return sendJson(res, 400, { success: false, error: 'Invalid beneficiary verification status' });
    }

    const b = queryOne('SELECT * FROM beneficiaries WHERE id = ?', [id]);
    if (!b) {
      return sendJson(res, 404, { success: false, error: 'Beneficiary not found' });
    }

    const oldStatus = b.status;
    const now = new Date().toISOString();
    const isBadge = status === 'VERIFIED' ? 1 : 0;

    transaction(() => {
      execute(
        `UPDATE beneficiaries
         SET status = ?, verification_badge = ?, verification_notes = ?, updated_at = ?
         WHERE id = ?`,
        [status, isBadge, notes || b.verification_notes, now, id]
      );

      execute(
        `INSERT INTO verification_records (beneficiary_id, admin_id, old_status, new_status, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, admin.id, oldStatus, status, notes || '', now]
      );
    });

    logAudit({
      actorType: 'ADMIN',
      actorId: String(admin.id),
      action: 'BENEFICIARY_STATUS_CHANGE',
      entityType: 'beneficiary',
      entityId: id,
      details: { oldStatus, newStatus: status, notes },
      ipAddress: req.socket.remoteAddress,
    });

    sendJson(res, 200, { success: true, message: `Status updated to ${status}` });
  } catch (err) {
    sendJson(res, 500, { success: false, error: err.message });
  }
}

async function handleGetDonations(req, res) {
  const admin = requireAdminAuth(req, res);
  if (!admin) return;

  const { status, search, limit = 50, offset = 0 } = req.query || {};
  let sql = `
    SELECT d.*, b.full_name as beneficiary_name, u.username as donor_username, u.first_name as donor_first_name
    FROM donations d
    LEFT JOIN beneficiaries b ON d.beneficiary_id = b.id
    LEFT JOIN users u ON d.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (status && status !== 'ALL') {
    sql += ' AND d.status = ?';
    params.push(status);
  }

  if (search) {
    sql += ' AND (d.donation_code LIKE ? OR d.transaction_id LIKE ? OR d.telegram_id LIKE ? OR b.full_name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  sql += ' ORDER BY d.id DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit, 10), parseInt(offset, 10));

  const list = queryAll(sql, params);
  sendJson(res, 200, { success: true, donations: list });
}

async function handleGetDonors(req, res) {
  const admin = requireAdminAuth(req, res);
  if (!admin) return;

  const donors = queryAll('SELECT * FROM users ORDER BY total_donated DESC LIMIT 100');
  sendJson(res, 200, { success: true, donors });
}

async function handleGetDistributions(req, res) {
  const admin = requireAdminAuth(req, res);
  if (!admin) return;

  const distributions = queryAll(`
    SELECT d.*, b.full_name as beneficiary_name, b.category
    FROM distributions d
    JOIN beneficiaries b ON d.beneficiary_id = b.id
    ORDER BY d.id DESC
  `);
  sendJson(res, 200, { success: true, distributions });
}

async function handleCreateDistribution(req, res) {
  const admin = requireAdminAuth(req, res);
  if (!admin) return;

  try {
    const body = await parseJsonBody(req);
    const {
      beneficiaryId,
      campaignId,
      amount,
      distributedDate,
      method,
      referenceNumber,
      proofDocument,
      notes,
      status = 'DISTRIBUTED',
    } = body;

    if (!beneficiaryId || !amount || !distributedDate || !method) {
      return sendJson(res, 400, { success: false, error: 'Missing required distribution fields' });
    }

    const cleanAmount = parseFloat(amount);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      return sendJson(res, 400, { success: false, error: 'Amount must be greater than zero' });
    }

    const now = new Date().toISOString();
    let distributionId;

    transaction(() => {
      execute(
        `INSERT INTO distributions (
          campaign_id, beneficiary_id, amount, currency, distributed_date,
          method, reference_number, admin_id, admin_name, proof_document,
          notes, status, created_at
        ) VALUES (?, ?, ?, 'USD', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          campaignId || null,
          parseInt(beneficiaryId, 10),
          cleanAmount,
          distributedDate,
          method,
          referenceNumber || `DIST-${Date.now()}`,
          admin.id,
          admin.fullName || admin.username,
          proofDocument || null,
          notes || null,
          status,
          now,
        ]
      );

      const created = queryOne('SELECT id FROM distributions ORDER BY id DESC LIMIT 1');
      distributionId = created.id;
    });

    logAudit({
      actorType: 'ADMIN',
      actorId: String(admin.id),
      action: 'DISTRIBUTION_RECORDED',
      entityType: 'distribution',
      entityId: distributionId,
      details: { beneficiaryId, amount: cleanAmount, method, referenceNumber },
      ipAddress: req.socket.remoteAddress,
    });

    sendJson(res, 201, { success: true, distributionId });
  } catch (err) {
    sendJson(res, 500, { success: false, error: err.message });
  }
}

async function handleBroadcast(req, res) {
  const admin = requireAdminAuth(req, res);
  if (!admin) return;

  try {
    const body = await parseJsonBody(req);
    const { messageText, mediaUrl, mediaType = 'text', confirm } = body;

    if (!confirm) {
      return sendJson(res, 400, { success: false, error: 'Broadcast confirmation required' });
    }

    if (!messageText || messageText.trim().length === 0) {
      return sendJson(res, 400, { success: false, error: 'Broadcast message text is required' });
    }

    const allUsers = queryAll('SELECT telegram_id FROM users');
    let sentCount = 0;
    let failedCount = 0;

    for (const u of allUsers) {
      try {
        if (mediaUrl && mediaType === 'photo') {
          await botService.client.sendPhoto(u.telegram_id, mediaUrl, {
            caption: messageText,
            parse_mode: 'HTML',
          });
        } else {
          await botService.client.sendMessage(u.telegram_id, messageText, {
            parse_mode: 'HTML',
          });
        }
        sentCount++;
      } catch (_) {
        failedCount++;
      }
    }

    const now = new Date().toISOString();
    execute(
      `INSERT INTO broadcast_logs (admin_id, message_text, media_type, media_url, total_targets, sent_count, failed_count, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?)`,
      [admin.id, messageText, mediaType, mediaUrl || null, allUsers.length, sentCount, failedCount, now]
    );

    logAudit({
      actorType: 'ADMIN',
      actorId: String(admin.id),
      action: 'BROADCAST_SENT',
      entityType: 'broadcast_logs',
      details: { totalTargets: allUsers.length, sentCount, failedCount },
      ipAddress: req.socket.remoteAddress,
    });

    sendJson(res, 200, {
      success: true,
      stats: { totalTargets: allUsers.length, sentCount, failedCount },
    });
  } catch (err) {
    sendJson(res, 500, { success: false, error: err.message });
  }
}

async function handleGetAuditLogs(req, res) {
  const admin = requireAdminAuth(req, res);
  if (!admin) return;

  const { limit = 100, offset = 0, action } = req.query || {};
  const logs = getRecentLogs(parseInt(limit, 10), parseInt(offset, 10), { action });
  sendJson(res, 200, { success: true, logs });
}

module.exports = {
  handleDashboardStats,
  handleGetBeneficiaries,
  handleCreateBeneficiary,
  handleUpdateBeneficiaryStatus,
  handleGetDonations,
  handleGetDonors,
  handleGetDistributions,
  handleCreateDistribution,
  handleBroadcast,
  handleGetAuditLogs,
};
