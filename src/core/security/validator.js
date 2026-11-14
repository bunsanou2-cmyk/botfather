/**
 * Input Validation & Sanitization Module
 */

const config = require('../../config');

const VALID_CATEGORIES = ['sick', 'student', 'elderly', 'team'];
const VALID_BENEFICIARY_STATUSES = ['DRAFT', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED', 'COMPLETED'];
const VALID_PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'];
const VALID_DISTRIBUTION_STATUSES = ['PENDING', 'PROCESSING', 'DISTRIBUTED'];

/**
 * Validates and formats a donation amount
 * Rejects values below minDonationAmount ($0.10)
 */
function validateDonationAmount(val) {
  if (val === undefined || val === null || val === '') {
    return { valid: false, error: 'Amount is required' };
  }

  // Support numeric input or clean string with potential $ symbol
  const cleaned = String(val).replace(/[$ ,]/g, '').trim();
  const num = Number(cleaned);

  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return { valid: false, error: 'Please enter a valid numeric amount' };
  }

  const rounded = Math.round(num * 100) / 100;

  if (rounded < config.payment.minDonationAmount) {
    return {
      valid: false,
      error: `Minimum donation is $${config.payment.minDonationAmount.toFixed(2)}`,
      amount: rounded,
    };
  }

  if (rounded > 50000) {
    return {
      valid: false,
      error: 'Donations exceeding $50,000 require manual verification by admin',
      amount: rounded,
    };
  }

  return { valid: true, amount: rounded };
}

/**
 * HTML escape to prevent injection in Telegram HTML parse mode and HTML templates
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validates beneficiary category
 */
function isValidCategory(category) {
  return VALID_CATEGORIES.includes(category);
}

/**
 * Validates beneficiary status
 */
function isValidBeneficiaryStatus(status) {
  return VALID_BENEFICIARY_STATUSES.includes(status);
}

module.exports = {
  validateDonationAmount,
  escapeHtml,
  isValidCategory,
  isValidBeneficiaryStatus,
  VALID_CATEGORIES,
  VALID_BENEFICIARY_STATUSES,
  VALID_PAYMENT_STATUSES,
  VALID_DISTRIBUTION_STATUSES,
};
