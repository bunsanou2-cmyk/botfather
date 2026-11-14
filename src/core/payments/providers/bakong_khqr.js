/**
 * Cambodian Bakong KHQR Provider
 * Implements National Bank of Cambodia (NBC) KHQR EMVCo Standard & Deep Links.
 */

const crypto = require('node:crypto');
const BasePaymentProvider = require('./base_provider');
const config = require('../../../config');

/**
 * CRC16/CCITT-FALSE implementation for KHQR compliance
 */
function crc16(str) {
  let crc = 0xffff;
  for (let c = 0; c < str.length; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function formatEmvTag(tag, value) {
  const strVal = String(value);
  const lengthStr = String(strVal.length).padStart(2, '0');
  return `${tag}${lengthStr}${strVal}`;
}

class BakongKHQRProvider extends BasePaymentProvider {
  constructor() {
    super('bakong_khqr', config.payment.mode);
  }

  /**
   * Generates authentic Bakong KHQR string adhering to NBC standard
   */
  generateKHQRString({ transactionId, amount, currency = 'USD' }) {
    const merchantId = config.payment.bakong.merchantId;
    const merchantName = config.payment.bakong.merchantName.slice(0, 25);
    const merchantCity = config.payment.bakong.merchantCity.slice(0, 15);
    const currencyCode = currency === 'USD' ? '840' : '116';

    // Sub-tags for Tag 29 (Merchant Account Info)
    const sub00 = formatEmvTag('00', merchantId);
    const sub01 = formatEmvTag('01', config.payment.bakong.acquiringBank);
    const tag29Value = `${sub00}${sub01}`;

    // Sub-tags for Tag 62 (Additional Data: Bill/Reference Number)
    const sub01Ref = formatEmvTag('01', transactionId.slice(0, 25));
    const tag62Value = `${sub01Ref}`;

    let payload = '';
    payload += formatEmvTag('00', '01'); // Payload format indicator
    payload += formatEmvTag('01', '12'); // Dynamic QR (contains amount)
    payload += formatEmvTag('29', tag29Value); // Merchant info
    payload += formatEmvTag('52', '5399'); // MCC (Charity/Social services)
    payload += formatEmvTag('53', currencyCode); // 840 = USD
    payload += formatEmvTag('54', amount.toFixed(2)); // Amount
    payload += formatEmvTag('58', 'KH'); // Country code
    payload += formatEmvTag('59', merchantName); // Merchant Name
    payload += formatEmvTag('60', merchantCity); // Merchant City
    payload += formatEmvTag('62', tag62Value); // Additional data / Reference

    // Tag 63: Checksum placeholder (Tag 63, length 04)
    const rawForCrc = `${payload}6304`;
    const checksum = crc16(rawForCrc);
    return `${rawForCrc}${checksum}`;
  }

  async createPaymentSession(params) {
    const { transactionId, donationCode, amount, currency = 'USD', beneficiaryName } = params;

    const khqrString = this.generateKHQRString({ transactionId, amount, currency });
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Universal deep link / payment display URL
    const paymentUrl = `${config.appUrl}/checkout/${encodeURIComponent(transactionId)}`;
    const bakongDeepLink = `bakong://pay?qr=${encodeURIComponent(khqrString)}`;

    return {
      paymentUrl,
      qrData: khqrString,
      deepLink: bakongDeepLink,
      providerTxId: `KHQR-${transactionId}`,
      expiresAt,
      mode: this.mode,
      instructions: 'Scan with ABA Mobile, Bakong App, ACLEDA, Wing, or any Cambodian banking app.',
    };
  }

  async verifyWebhook(headers, rawBody) {
    const signature = headers['x-bakong-signature'] || headers['x-payment-signature'];
    const secret = config.payment.webhookSecret;

    let payload;
    try {
      payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    } catch (_) {
      return { isValid: false, error: 'Invalid JSON payload' };
    }

    if (secret && signature) {
      const computed = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
      if (signature !== computed) {
        return { isValid: false, error: 'Signature mismatch' };
      }
    }

    return {
      isValid: true,
      transactionId: payload.external_transaction_id || payload.transactionId,
      providerTxId: payload.bakong_hash || payload.providerTxId,
      status: payload.status === 'SUCCESS' || payload.status === 'PAID' ? 'PAID' : 'FAILED',
      amount: payload.amount,
      rawPayload: payload,
    };
  }

  async queryPaymentStatus(transactionId) {
    // In production with Bakong Open API, this polls the Bakong transaction hash status
    return {
      transactionId,
      status: 'PENDING',
    };
  }
}

module.exports = BakongKHQRProvider;
