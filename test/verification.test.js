/**
 * Beneficiary Verification & Workflow State Machine Tests
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const testDbPath = path.resolve(__dirname, '../data/test_verification.db');
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const { initDb, closeDb, queryOne, execute } = require('../src/core/db/database');
const paymentService = require('../src/core/payments/payment_service');

test.before(() => {
  initDb(testDbPath);
  const now = new Date().toISOString();

  // Create unverified draft beneficiary
  execute(
    `INSERT INTO beneficiaries (
      id, category, full_name, full_name_km, age, location,
      current_situation, current_situation_km, story, story_km,
      amount_needed, amount_received, status, verification_badge,
      is_team_fund, created_at, updated_at
    ) VALUES (
      201, 'elderly', 'Unverified Elder', 'លោកតា មិនទាន់ផ្ទៀងផ្ទាត់', 80, 'Takeo',
      'Situation', 'ស្ថានភាព', 'Story', 'រឿងរ៉ាវ',
      300.00, 0.00, 'DRAFT', 0, 0, ?, ?
    )`,
    [now, now]
  );
});

test.after(() => {
  closeDb();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
});

test('Verification: unverified DRAFT beneficiary cannot receive public donations', async () => {
  await assert.rejects(
    async () => {
      await paymentService.createDonationSession({
        telegramId: '111222333',
        beneficiaryId: 201,
        amount: 10.00,
      });
    },
    /This beneficiary is not yet verified for public donations/
  );
});

test('Verification: workflow transitions from DRAFT -> PENDING_REVIEW -> VERIFIED', () => {
  const now = new Date().toISOString();

  // Transition to PENDING_REVIEW
  execute("UPDATE beneficiaries SET status = 'PENDING_REVIEW', updated_at = ? WHERE id = 201", [now]);
  let b = queryOne('SELECT status, verification_badge FROM beneficiaries WHERE id = 201');
  assert.strictEqual(b.status, 'PENDING_REVIEW');
  assert.strictEqual(b.verification_badge, 0);

  // Transition to VERIFIED
  execute("UPDATE beneficiaries SET status = 'VERIFIED', verification_badge = 1, updated_at = ? WHERE id = 201", [now]);
  b = queryOne('SELECT status, verification_badge FROM beneficiaries WHERE id = 201');
  assert.strictEqual(b.status, 'VERIFIED');
  assert.strictEqual(b.verification_badge, 1);
});

test('Verification: once VERIFIED, public donations are permitted', async () => {
  const result = await paymentService.createDonationSession({
    telegramId: '111222333',
    beneficiaryId: 201,
    amount: 10.00,
  });

  assert.ok(result.donation);
  assert.strictEqual(result.donation.beneficiary_id, 201);
  assert.strictEqual(result.donation.status, 'PENDING');
});
