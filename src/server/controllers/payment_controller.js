/**
 * Payment Controller
 * Handles interactive checkout sessions, test payment simulator, and receipt lookups.
 */

const paymentService = require('../../core/payments/payment_service');
const { queryOne } = require('../../core/db/database');
const { parseJsonBody, sendJson } = require('../router');
const config = require('../../config');

async function handleGetCheckoutInfo(req, res) {
  const transactionId = req.params.transactionId;
  const donation = paymentService.getDonationByTransactionId(transactionId);

  if (!donation) {
    return sendJson(res, 404, { success: false, error: 'Transaction not found' });
  }

  const beneficiary = queryOne('SELECT * FROM beneficiaries WHERE id = ?', [donation.beneficiary_id]);
  const campaign = donation.campaign_id
    ? queryOne('SELECT * FROM campaigns WHERE id = ?', [donation.campaign_id])
    : null;

  sendJson(res, 200, {
    success: true,
    mode: config.payment.mode,
    donation: {
      id: donation.id,
      donationCode: donation.donation_code,
      transactionId: donation.transaction_id,
      amount: donation.amount,
      currency: donation.currency,
      status: donation.status,
      paymentProvider: donation.payment_provider,
      paidAt: donation.paid_at,
      createdAt: donation.created_at,
    },
    beneficiary: beneficiary ? {
      id: beneficiary.id,
      fullName: beneficiary.full_name,
      fullNameKm: beneficiary.full_name_km,
      category: beneficiary.category,
      location: beneficiary.location,
      profileImageUrl: beneficiary.profile_image_url,
      currentSituation: beneficiary.current_situation,
      amountNeeded: beneficiary.amount_needed,
      amountReceived: beneficiary.amount_received,
    } : null,
    campaign,
  });
}

/**
 * Endpoint for the Interactive Test Mode Checkout Page
 * Allows immediate completion without real payment gateway credentials.
 */
async function handleTestPaymentComplete(req, res) {
  try {
    const body = await parseJsonBody(req);
    const { transactionId, status = 'PAID', note = 'Completed via Test Checkout Simulator' } = body;

    if (!transactionId) {
      return sendJson(res, 400, { success: false, error: 'transactionId is required' });
    }

    if (config.payment.mode !== 'test' && !process.env.ALLOW_TEST_PAYMENTS) {
      return sendJson(res, 403, {
        success: false,
        error: 'Test payments are disabled in PRODUCTION mode',
      });
    }

    if (status === 'PAID') {
      const result = await paymentService.processPaymentSuccess({
        transactionId,
        providerTxId: `TEST-SIM-${Date.now()}`,
        rawPayload: { simulated: true, note, timestamp: new Date().toISOString() },
        ipAddress: req.socket.remoteAddress,
      });

      return sendJson(res, 200, {
        success: true,
        message: 'Payment simulated successfully. Receipt dispatched to Telegram.',
        donation: result.donation,
      });
    } else {
      await paymentService.processPaymentFailure({
        transactionId,
        reason: 'User cancelled or simulation declined',
        rawPayload: { simulated: true, status: 'FAILED' },
      });

      return sendJson(res, 200, {
        success: true,
        message: 'Payment simulation marked as FAILED / CANCELLED',
      });
    }
  } catch (err) {
    sendJson(res, 500, { success: false, error: err.message });
  }
}

module.exports = {
  handleGetCheckoutInfo,
  handleTestPaymentComplete,
};
