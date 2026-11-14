/**
 * Payment Service & Idempotency Tests
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

// Use isolated test DB
const testDbPath = path.resolve(__dirname, '../data/test_payments.db');
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const { initDb, closeDb, queryOne, execute } = require('../src/core/db/database');
const paymentService = require('../src/core/payments/payment_service');

test.before(() => {
  initDb(testDbPath);
  const now = new Date().toISOString();

  // Create a test verified beneficiary
  execute(
    `INSERT INTO beneficiaries (
      id, category, full_name, full_name_km, age, location,
      current_situation, current_situation_km, story, story_km,
      amount_needed, amount_received, status, verification_badge,
      is_team_fund, created_at, updated_at
    ) VALUES (
      101, 'sick', 'Test Beneficiary', 'អ្នកទទួលផលតេស្ត', 45, 'Phnom Penh',
      'Test situation', 'ស្ថានភាពតេស្ត', 'Test story', 'រឿងរ៉ាវតេស្ត',
      100.00, 0.00, 'VERIFIED', 1, 0, ?, ?
    )`,
    [now, now]
  );

  // Create corresponding test campaign
  execute(
    `INSERT INTO campaigns (
      id, beneficiary_id, title, title_km, target_amount, current_amount, status, start_date, created_at, updated_at
    ) VALUES (
      101, 101, 'Test Campaign', 'យុទ្ធនាការតេស្ត', 100.00, 0.00, 'ACTIVE', ?, ?, ?
    )`,
    [now, now, now]
  );
});

test.after(() => {
  closeDb();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
});

test('PaymentService: createDonationSession creates valid pending donation', async () => {
  const result = await paymentService.createDonationSession({
    telegramId: '987654321',
    beneficiaryId: 101,
    amount: 10.00,
  });

  assert.ok(result.donation);
  assert.strictEqual(result.donation.amount, 10.00);
  assert.strictEqual(result.donation.status, 'PENDING');
  assert.ok(result.donation.transaction_id);
  assert.ok(result.session.paymentUrl);
});

test('PaymentService: rejects donation if amount < $0.10', async () => {
  await assert.rejects(
    async () => {
      await paymentService.createDonationSession({
        telegramId: '987654321',
        beneficiaryId: 101,
        amount: 0.05,
      });
    },
    /Minimum donation is \$0\.10/
  );
});

test('PaymentService: processPaymentSuccess updates donation, beneficiary balance, and donor stats', async () => {
  const session = await paymentService.createDonationSession({
    telegramId: '987654321',
    beneficiaryId: 101,
    amount: 25.00,
  });

  const txId = session.donation.transaction_id;

  const result = await paymentService.processPaymentSuccess({
    transactionId: txId,
    providerTxId: 'EXT-12345',
    rawPayload: { success: true },
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.donation.status, 'PAID');
  assert.strictEqual(result.beneficiary.amount_received, 25.00);

  // Check user stats
  const user = queryOne('SELECT * FROM users WHERE telegram_id = ?', ['987654321']);
  assert.strictEqual(user.total_donated, 25.00);
  assert.strictEqual(user.donation_count, 1);
});

test('PaymentService: Idempotency prevents double-counting duplicate payment webhooks', async () => {
  const session = await paymentService.createDonationSession({
    telegramId: '987654321',
    beneficiaryId: 101,
    amount: 15.00,
  });

  const txId = session.donation.transaction_id;

  // Process 1st time
  const res1 = await paymentService.processPaymentSuccess({ transactionId: txId });
  assert.strictEqual(res1.alreadyProcessed, false);

  // Process 2nd time (duplicate callback)
  const res2 = await paymentService.processPaymentSuccess({ transactionId: txId });
  assert.strictEqual(res2.alreadyProcessed, true);

  // Beneficiary balance should have increased by only 15.00 (from 25 to 40)
  const b = queryOne('SELECT amount_received FROM beneficiaries WHERE id = 101');
  assert.strictEqual(b.amount_received, 40.00);
});

test('PaymentService: Target reached triggers automatically when target is fulfilled', async () => {
  // Target is 100. Current is 40. Donate 60.
  const session = await paymentService.createDonationSession({
    telegramId: '987654321',
    beneficiaryId: 101,
    amount: 60.00,
  });

  const res = await paymentService.processPaymentSuccess({
    transactionId: session.donation.transaction_id,
  });

  assert.strictEqual(res.targetReached, true);
  assert.strictEqual(res.campaign.status, 'TARGET_REACHED');
  assert.strictEqual(res.campaign.current_amount, 100.00);
});
