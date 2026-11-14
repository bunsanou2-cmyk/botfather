/**
 * Base Payment Provider Interface
 * All payment gateway implementations (Bakong KHQR, Test Provider, Stripe, ABA PayWay) inherit from this.
 */

class BasePaymentProvider {
  constructor(name, mode = 'test') {
    this.name = name;
    this.mode = mode; // 'test' | 'production'
  }

  /**
   * Create a payment session/invoice
   * @param {Object} params - { transactionId, donationCode, amount, currency, beneficiaryName, description, returnUrl, webhookUrl }
   * @returns {Promise<Object>} - { paymentUrl, qrData, providerTxId, rawResponse, expiresAt }
   */
  async createPaymentSession(_params) {
    throw new Error('createPaymentSession must be implemented by provider');
  }

  /**
   * Verify webhook signature and extract transaction data
   * @param {Object} headers - HTTP headers
   * @param {string|Buffer} body - Raw body payload
   * @returns {Promise<Object>} - { isValid, transactionId, providerTxId, status, amount, rawPayload }
   */
  async verifyWebhook(_headers, _body) {
    throw new Error('verifyWebhook must be implemented by provider');
  }

  /**
   * Query status from gateway API
   * @param {string} transactionId
   * @returns {Promise<Object>} - { status, providerTxId, paidAt }
   */
  async queryPaymentStatus(_transactionId) {
    throw new Error('queryPaymentStatus must be implemented by provider');
  }
}

module.exports = BasePaymentProvider;
