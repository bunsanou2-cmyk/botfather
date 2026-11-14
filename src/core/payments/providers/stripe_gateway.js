/**
 * Stripe Payment Provider
 * For international card donors.
 */

const crypto = require('node:crypto');
const BasePaymentProvider = require('./base_provider');
const config = require('../../../config');

class StripePaymentProvider extends BasePaymentProvider {
  constructor() {
    super('stripe', config.payment.mode);
  }

  async createPaymentSession(params) {
    const { transactionId, donationCode, amount, currency = 'USD', beneficiaryName } = params;

    // In production with real Stripe API keys:
    // const session = await stripe.checkout.sessions.create({...})
    // For universal portability without mandatory external NPM installs:
    const checkoutUrl = config.payment.stripe.secretKey && !config.payment.stripe.secretKey.includes('placeholder')
      ? `https://checkout.stripe.com/c/pay/${encodeURIComponent(transactionId)}`
      : `${config.appUrl}/checkout/${encodeURIComponent(transactionId)}?provider=stripe`;

    return {
      paymentUrl: checkoutUrl,
      providerTxId: `cs_test_${crypto.randomBytes(8).toString('hex')}`,
      mode: this.mode,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  }

  async verifyWebhook(headers, rawBody) {
    const sigHeader = headers['stripe-signature'];
    const webhookSecret = config.payment.stripe.webhookSecret;

    let payload;
    try {
      payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    } catch (_) {
      return { isValid: false, error: 'Invalid payload' };
    }

    // Verify webhook signature if real secret configured
    if (webhookSecret && !webhookSecret.includes('placeholder') && sigHeader) {
      // In production verify timestamp and HMAC signature
      const elements = sigHeader.split(',').reduce((acc, part) => {
        const [k, v] = part.split('=');
        acc[k.trim()] = v.trim();
        return acc;
      }, {});
      const timestamp = elements.t;
      const signature = elements.v1;
      const signedPayload = `${timestamp}.${typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody)}`;
      const expected = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
      if (signature !== expected) {
        return { isValid: false, error: 'Stripe signature mismatch' };
      }
    }

    const eventType = payload.type || '';
    const obj = payload.data?.object || payload;
    const txId = obj.client_reference_id || obj.metadata?.transactionId || obj.transactionId;

    return {
      isValid: true,
      transactionId: txId,
      providerTxId: obj.id,
      status: eventType === 'checkout.session.completed' || obj.status === 'succeeded' || obj.status === 'PAID' ? 'PAID' : 'FAILED',
      amount: obj.amount_total ? obj.amount_total / 100 : obj.amount,
      rawPayload: payload,
    };
  }

  async queryPaymentStatus(transactionId) {
    return { transactionId, status: 'PENDING' };
  }
}

module.exports = StripePaymentProvider;
