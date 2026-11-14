/**
 * Public Controller
 * Provides non-sensitive public endpoints for transparency, receipts, and public web viewers.
 */

const { queryOne, queryAll } = require('../../core/db/database');
const { sendJson } = require('../router');

async function handleGetPublicTransparency(req, res) {
  const totalDonations = queryOne("SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM donations WHERE status = 'PAID'");
  const totalDistributions = queryOne("SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM distributions WHERE status = 'DISTRIBUTED'");
  const activeCampaigns = queryOne("SELECT COUNT(*) as count FROM campaigns WHERE status = 'ACTIVE'");
  const completedCampaigns = queryOne("SELECT COUNT(*) as count FROM campaigns WHERE status IN ('TARGET_REACHED', 'COMPLETED')");
  const verifiedBeneficiaries = queryOne("SELECT COUNT(*) as count FROM beneficiaries WHERE status = 'VERIFIED'");

  const recentDistributions = queryAll(`
    SELECT d.amount, d.distributed_date, d.method, d.reference_number,
           b.full_name, b.full_name_km, b.category, b.location
    FROM distributions d
    JOIN beneficiaries b ON d.beneficiary_id = b.id
    WHERE d.status = 'DISTRIBUTED'
    ORDER BY d.id DESC LIMIT 10
  `);

  sendJson(res, 200, {
    success: true,
    transparency: {
      totalDonationsReceived: totalDonations.total,
      totalDonationsCount: totalDonations.count,
      totalAssistanceDistributed: totalDistributions.total,
      verifiedBeneficiariesCount: verifiedBeneficiaries.count,
      activeCampaignsCount: activeCampaigns.count,
      completedCampaignsCount: completedCampaigns.count,
    },
    recentDistributions,
  });
}

async function handleGetPublicReceipt(req, res) {
  const txId = req.params.transactionId;
  const donation = queryOne(
    `SELECT d.id, d.donation_code, d.transaction_id, d.amount, d.currency, d.status,
            d.payment_provider, d.paid_at, d.created_at, d.is_anonymous,
            b.full_name as beneficiary_name, b.full_name_km as beneficiary_name_km, b.category
     FROM donations d
     JOIN beneficiaries b ON d.beneficiary_id = b.id
     WHERE d.transaction_id = ?`,
    [txId]
  );

  if (!donation) {
    return sendJson(res, 404, { success: false, error: 'Receipt not found' });
  }

  sendJson(res, 200, { success: true, receipt: donation });
}

module.exports = {
  handleGetPublicTransparency,
  handleGetPublicReceipt,
};
