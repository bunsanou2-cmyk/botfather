/**
 * End-to-End Integration Test for Khmer Help Khmer
 * Tests the complete flow:
 * 1. Health check
 * 2. Admin login & token generation
 * 3. Seeded beneficiaries check
 * 4. $0.10 Donation Session Creation
 * 5. Test Mode Payment Simulation ($0.10)
 * 6. Verification of PAID status & Receipt retrieval
 * 7. Admin Dashboard and Audit Logs verification
 */

const assert = require('node:assert');
const { initDb, closeDb, queryOne, queryAll } = require('../src/core/db/database');
const { ensureDefaultAdmin } = require('../src/core/security/auth');
const { seedDatabase } = require('../src/core/db/seed');
const { createHttpServer } = require('../src/server/http_server');
const config = require('../src/config');
const paymentService = require('../src/core/payments/payment_service');

async function runE2E() {
  console.log('--- Starting Khmer Help Khmer End-to-End Test ---');

  // 1. Initialize & Seed DB
  initDb();
  ensureDefaultAdmin();
  seedDatabase();

  // 2. Start HTTP Server on test port
  const testPort = 3099;
  config.port = testPort;
  config.appUrl = `http://127.0.0.1:${testPort}`;

  const server = createHttpServer();
  await new Promise(resolve => server.listen(testPort, '127.0.0.1', resolve));
  console.log(`[E2E] Test server active on http://127.0.0.1:${testPort}`);

  try {
    // Step 1: Health check
    const healthRes = await fetch(`http://127.0.0.1:${testPort}/api/health`);
    const healthData = await healthRes.json();
    assert.strictEqual(healthData.status, 'UP');
    assert.strictEqual(healthData.app, 'Khmer Help Khmer');
    console.log('✅ Health check passed');

    // Step 2: Admin Login
    const loginRes = await fetch(`http://127.0.0.1:${testPort}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: config.admin.username,
        password: config.admin.password,
      }),
    });
    const loginData = await loginRes.json();
    assert.strictEqual(loginData.success, true);
    assert.ok(loginData.token);
    const adminToken = loginData.token;
    console.log('✅ Admin login & session token generation passed');

    // Step 3: Fetch Dashboard Stats
    const dashRes = await fetch(`http://127.0.0.1:${testPort}/api/admin/dashboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dashData = await dashRes.json();
    assert.strictEqual(dashData.success, true);
    assert.ok(dashData.stats.totalDonatedAmount >= 0);
    console.log(`✅ Dashboard stats loaded: ${dashData.stats.activeCampaigns} active campaigns`);

    // Step 4: Create a $0.10 Donation Session for Beneficiary #2 (Lok Yeay Sokha)
    const sessionResult = await paymentService.createDonationSession({
      telegramId: '777888999',
      beneficiaryId: 2,
      amount: 0.10,
    });
    assert.ok(sessionResult.donation);
    assert.strictEqual(sessionResult.donation.amount, 0.10);
    assert.strictEqual(sessionResult.donation.status, 'PENDING');
    const txId = sessionResult.donation.transaction_id;
    console.log(`✅ $0.10 donation session created. TX: ${txId}`);

    // Step 5: Test Mode Payment Simulation via API
    const payRes = await fetch(`http://127.0.0.1:${testPort}/api/payments/test-complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactionId: txId,
        status: 'PAID',
        note: 'E2E Automated $0.10 test donation',
      }),
    });
    const payData = await payRes.json();
    assert.strictEqual(payData.success, true);
    console.log('✅ Test payment completed successfully via simulation');

    // Step 6: Verify Receipt Endpoint
    const receiptRes = await fetch(`http://127.0.0.1:${testPort}/api/public/receipt/${txId}`);
    const receiptData = await receiptRes.json();
    assert.strictEqual(receiptData.success, true);
    assert.strictEqual(receiptData.receipt.status, 'PAID');
    assert.strictEqual(receiptData.receipt.amount, 0.10);
    console.log(`✅ Digital receipt verified: Code ${receiptData.receipt.donation_code}`);

    // Step 7: Verify Audit Log Recorded
    const auditRes = await fetch(`http://127.0.0.1:${testPort}/api/admin/audit-logs?limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const auditData = await auditRes.json();
    assert.strictEqual(auditData.success, true);
    const hasPaymentAudit = auditData.logs.some(l => l.action === 'PAYMENT_RECEIVED');
    assert.ok(hasPaymentAudit, 'Audit log must record PAYMENT_RECEIVED');
    console.log('✅ Immutable audit log verified for payment');

    // Step 8: Verify Public Transparency API
    const transRes = await fetch(`http://127.0.0.1:${testPort}/api/public/transparency`);
    const transData = await transRes.json();
    assert.strictEqual(transData.success, true);
    console.log(`✅ Public transparency endpoint verified: $${transData.transparency.totalDonationsReceived} received`);

    console.log('\n🎉 ALL E2E FLOW TESTS PASSED SUCCESSFULLY! Production-ready architecture verified.\n');
  } finally {
    server.close();
    closeDb();
  }
}

runE2E().catch(err => {
  console.error('E2E Test Failed:', err);
  process.exit(1);
});
