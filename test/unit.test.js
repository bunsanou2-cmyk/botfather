/**
 * Unit Tests for Validation, Security, Math, and i18n
 */

const test = require('node:test');
const assert = require('node:assert');
const { validateDonationAmount } = require('../src/core/security/validator');
const { renderProgressBar, calculateProgress } = require('../src/bot/helpers');
const { hashPassword, verifyPassword } = require('../src/core/security/auth');
const { t } = require('../src/bot/i18n');

test('Validation: accepts minimum donation of $0.10', () => {
  const result = validateDonationAmount('0.10');
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.amount, 0.10);
});

test('Validation: accepts valid amounts with dollar signs and decimals', () => {
  const r1 = validateDonationAmount('$10.50');
  assert.strictEqual(r1.valid, true);
  assert.strictEqual(r1.amount, 10.50);

  const r2 = validateDonationAmount('100');
  assert.strictEqual(r2.valid, true);
  assert.strictEqual(r2.amount, 100.00);
});

test('Validation: rejects amounts below $0.10', () => {
  const r1 = validateDonationAmount('0.05');
  assert.strictEqual(r1.valid, false);
  assert.match(r1.error, /Minimum donation is \$0\.10/);

  const r2 = validateDonationAmount('0');
  assert.strictEqual(r2.valid, false);

  const r3 = validateDonationAmount('-5.00');
  assert.strictEqual(r3.valid, false);
});

test('Validation: rejects non-numeric inputs', () => {
  const result = validateDonationAmount('abc');
  assert.strictEqual(result.valid, false);
});

test('Helpers: calculateProgress calculates percentage and remaining balance', () => {
  const { progress, remaining } = calculateProgress(1000, 350);
  assert.strictEqual(progress, 35);
  assert.strictEqual(remaining, 650);

  const complete = calculateProgress(500, 500);
  assert.strictEqual(complete.progress, 100);
  assert.strictEqual(complete.remaining, 0);
});

test('Helpers: renderProgressBar produces expected visual string', () => {
  const bar = renderProgressBar(50, 10);
  assert.strictEqual(bar, '[█████░░░░░] 50%');
});

test('Security: PBKDF2 password hashing and verification', () => {
  const password = 'KhmerHelpKhmerSecretPass123!';
  const hash = hashPassword(password);
  assert.strictEqual(typeof hash, 'string');
  assert.ok(hash.includes(':'));

  assert.strictEqual(verifyPassword(password, hash), true);
  assert.strictEqual(verifyPassword('WrongPass', hash), false);
});

test('i18n: translations resolve in Khmer and English', () => {
  assert.strictEqual(t('km', 'btnHelpSick'), '❤️ ជួយអ្នកជំងឺ');
  assert.strictEqual(t('en', 'btnHelpSick'), '❤️ Help Sick People');
});
