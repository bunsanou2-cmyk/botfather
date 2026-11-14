/**
 * Full Bot Flow End-to-End Simulation Test
 * Tests:
 * 1. START BOT
 * 2. SELECT CATEGORY (Sick, Student, Elderly)
 * 3. VIEW BENEFICIARY
 * 4. DONATE (Preset & Custom Amount)
 * 5. PAYMENT SESSION GENERATION
 * 6. PAYMENT WEBHOOK EXECUTION
 * 7. CONFIRM DONATION & RECEIPT
 * 8. TRANSACTION RECORD & MY DONATIONS
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const testDbPath = path.resolve(__dirname, '../data/test_bot_flow.db');
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const { initDb, closeDb, queryOne, execute } = require('../src/core/db/database');
const TelegramClient = require('../src/bot/telegram_client');
const BotDispatcher = require('../src/bot/bot_dispatcher');
const paymentService = require('../src/core/payments/payment_service');

// Spy/Mock client
class MockTelegramClient extends TelegramClient {
  constructor() {
    super('mock_token_123456');
    this.sentMessages = [];
    this.sentPhotos = [];
    this.answeredCallbacks = [];
    this.outgoing = [];
  }

  async sendMessage(chatId, text, options = {}) {
    const item = { type: 'message', chatId, text, options };
    this.sentMessages.push(item);
    this.outgoing.push(item);
    return { ok: true, result: { message_id: this.sentMessages.length } };
  }

  async sendPhoto(chatId, photo, options = {}) {
    const item = { type: 'photo', chatId, photo, options, text: options.caption || '' };
    this.sentPhotos.push(item);
    this.outgoing.push(item);
    return { ok: true, result: { message_id: this.sentPhotos.length } };
  }

  async answerCallbackQuery(callbackQueryId, options = {}) {
    this.answeredCallbacks.push({ callbackQueryId, options });
    return { ok: true };
  }

  lastOutgoing() {
    return this.outgoing[this.outgoing.length - 1];
  }
}

let mockClient;
let dispatcher;

test.before(() => {
  initDb(testDbPath);
  const now = new Date().toISOString();

  // Create sample verified sick beneficiary
  execute(
    `INSERT INTO beneficiaries (
      id, category, full_name, full_name_km, age, location,
      current_situation, current_situation_km, story, story_km,
      amount_needed, amount_received, status, verification_badge,
      is_team_fund, created_at, updated_at
    ) VALUES (
      301, 'sick', 'Lok Yeay Sokha', 'លោកយាយ សុខា', 72, 'Battambang',
      'Diabetes & kidney dialysis', 'ជំងឺទឹកនោមផ្អែម និងលាងឈាម', 'Full life story', 'រឿងរ៉ាវជីវិត',
      1000.00, 200.00, 'VERIFIED', 1, 0, ?, ?
    )`,
    [now, now]
  );

  execute(
    `INSERT INTO campaigns (
      id, beneficiary_id, title, title_km, target_amount, current_amount, status, start_date, created_at, updated_at
    ) VALUES (
      301, 301, 'Emergency Care for Lok Yeay Sokha', 'សង្គ្រោះបន្ទាន់លោកយាយ សុខា', 1000.00, 200.00, 'ACTIVE', ?, ?, ?
    )`,
    [now, now, now]
  );

  mockClient = new MockTelegramClient();
  dispatcher = new BotDispatcher(mockClient);
});

test.after(() => {
  closeDb();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
});

test('Flow Step 1: User sends /start -> Bot responds with welcome banner & inline menu', async () => {
  await dispatcher.dispatchUpdate({
    message: {
      chat: { id: 555001 },
      from: { id: 555001, first_name: 'Sophea', username: 'sophea_donor' },
      text: '/start',
    },
  });

  const response = mockClient.lastOutgoing();
  assert.ok(response, 'Bot should have responded to /start');
  const captionOrText = response.text || response.options?.caption;
  assert.match(captionOrText, /KHMER HELP KHMER|ខ្មែរជួយខ្មែរ/);
});

test('Flow Step 2: User clicks Help Sick People -> Bot presents verified beneficiary card', async () => {
  await dispatcher.dispatchUpdate({
    callback_query: {
      id: 'cb_1',
      message: { chat: { id: 555001 } },
      data: 'cat_sick',
    },
  });

  const response = mockClient.lastOutgoing();
  const content = response.text || response.options?.caption;
  assert.match(content, /Lok Yeay Sokha|លោកយាយ សុខា/);
  assert.match(content, /1,000/); // Needed amount
});

test('Flow Step 3: User clicks VIEW DETAILS -> Bot presents full story & progress bar', async () => {
  await dispatcher.dispatchUpdate({
    callback_query: {
      id: 'cb_2',
      message: { chat: { id: 555001 } },
      data: 'view_301',
    },
  });

  const response = mockClient.lastOutgoing();
  const content = response.text || response.options?.caption;
  assert.match(content, /Full life story|រឿងរ៉ាវជីវិត/);
  assert.match(content, /█/); // Progress bar character
});

test('Flow Step 4: User clicks DONATE -> Bot prompts amount options ($0.10, $1, etc.)', async () => {
  await dispatcher.dispatchUpdate({
    callback_query: {
      id: 'cb_3',
      message: { chat: { id: 555001 } },
      data: 'donate_301',
    },
  });

  const response = mockClient.lastOutgoing();
  assert.match(response.text, /0\.10/);
});

test('Flow Step 5: User chooses $10.00 preset -> Bot creates session & sends PAY NOW button', async () => {
  await dispatcher.dispatchUpdate({
    callback_query: {
      id: 'cb_4',
      message: { chat: { id: 555001 } },
      data: 'amt_301_10.00',
    },
  });

  const response = mockClient.lastOutgoing();
  assert.match(response.text, /\$10\.00/);
  assert.match(response.text, /TX-/);

  // Check keyboard has URL
  const payBtn = response.options?.reply_markup?.inline_keyboard?.[0]?.[0];
  assert.ok(payBtn);
  assert.ok(payBtn.url);
  assert.match(payBtn.url, /\/checkout\/TX-/);
});

test('Flow Step 6: Payment completed -> Webhook marks PAID and updates balances & receipt', async () => {
  // Find the created donation
  const donation = queryOne("SELECT * FROM donations WHERE telegram_id = '555001' ORDER BY id DESC LIMIT 1");
  assert.ok(donation);
  assert.strictEqual(donation.status, 'PENDING');

  // Process payment webhook completion
  const result = await paymentService.processPaymentSuccess({
    transactionId: donation.transaction_id,
    providerTxId: 'PAY-WEBHOOK-999',
    rawPayload: { webhook: true },
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.donation.status, 'PAID');

  // Verify beneficiary amount received updated from 200 to 210
  const ben = queryOne('SELECT amount_received FROM beneficiaries WHERE id = 301');
  assert.strictEqual(ben.amount_received, 210.00);
});

test('Flow Step 7: User checks My Donations -> Shows updated total and count', async () => {
  await dispatcher.dispatchUpdate({
    callback_query: {
      id: 'cb_5',
      message: { chat: { id: 555001 } },
      data: 'nav_my_donations',
    },
  });

  const response = mockClient.lastOutgoing();
  assert.match(response.text, /\$10\.00/);
  assert.match(response.text, /1/); // 1 donation
});
