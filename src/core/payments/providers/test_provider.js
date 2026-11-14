/**
 * Test Payment Provider (Simulated Gateway for Development & Testing)
 * Clearly separated from production mode.
 * Provides interactive web checkout & automated test endpoints without real money.
 */

const crypto = require('node:crypto');
const BasePaymentProvider = require('./base_provider');
const config = require('../../../config');

class TestPaymentProvider extends BasePaymentProvider {
  constructor() {
    super('test', 'test');
  }

  async createPaymentSession(params) {
    const { transactionId, donationCode, amount, currency = 'USD', beneficiaryName } = params;

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins expiry
    const checkoutUrl = `${config.appUrl}/checkout/${encodeURIComponent(transactionId)}`;

    // Simulated KHQR string for testing display
    const qrData = `KHK_TEST_QR|TX=${transactionId}|AMT=${amount.toFixed(2)}|CUR=${currency}|BEN=${encodeURIComponent(beneficiaryName)}`;

    return {
      paymentUrl: checkoutUrl,
      qrData,
      providerTxId: `TEST-GW-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
      expiresAt,
      mode: 'TEST_MODE',
      instructions: 'Open the payment link in your browser to simulate approval or decline.',
    };
  }

  async verifyWebhook(headers, rawBody) {
    const signature = headers['x-payment-signature'] || headers['x-test-signature'];
    const secret = config.payment.webhookSecret;

    let payload;
    try {
      payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    } catch (_) {
      return { isValid: false, error: 'Invalid JSON payload' };
    }

    // In test mode, verify signature if provided, or accept valid test token
    if (signature) {
      const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
      if (signature !== expected && signature !== 'test_bypass_sig') {
        return { isValid: false, error: 'Invalid webhook signature' };
      }
    }

    return {
      isValid: true,
      transactionId: payload.transactionId,
      providerTxId: payload.providerTxId || `TEST-TX-${Date.now()}`,
      status: payload.status === 'PAID' ? 'PAID' : (payload.status === 'FAILED' ? 'FAILED' : 'CANCELLED'),
      amount: payload.amount,
      rawPayload: payload,
    };
  }

  async queryPaymentStatus(transactionId) {
    return {
      transactionId,
      status: 'PENDING',
      mode: 'TEST_MODE',
    };
  }
}

module.exports = TestPaymentProvider;
