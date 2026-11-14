/**
 * Central Payment Orchestration Service
 * Handles donation session creation, provider routing, idempotency guards,
 * atomic balance and campaign updates, and audit logging.
 */

const crypto = require('node:crypto');
const config = require('../../config');
const { queryOne, queryAll, execute, transaction } = require('../db/database');
const { validateDonationAmount } = require('../security/validator');
const { logAudit } = require('../audit/audit_logger');
const notifier = require('../notifications/notifier');

const TestPaymentProvider = require('./providers/test_provider');
const BakongKHQRProvider = require('./providers/bakong_khqr');
const StripePaymentProvider = require('./providers/stripe_gateway');

class PaymentService {
  constructor() {
    this.providers = new Map();
    this.registerProvider('test', new TestPaymentProvider());
    this.registerProvider('bakong_khqr', new BakongKHQRProvider());
    this.registerProvider('stripe', new StripePaymentProvider());
  }

  registerProvider(name, instance) {
    this.providers.set(name, instance);
  }

  getProvider(name) {
    const providerName = name || config.payment.provider;
    const provider = this.providers.get(providerName);
    if (!provider) {
      // Fallback to test provider if unknown
      return this.providers.get('test');
    }
    return provider;
  }

  /**
   * Initializes a pending donation session and generates payment links/QR
   */
  async createDonationSession({
    telegramId,
    beneficiaryId,
    amount,
    currency = 'USD',
    donorNote = '',
    isAnonymous = false,
    providerName = null,
  }) {
    // 1. Validate amount
    const validation = validateDonationAmount(amount);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    const cleanAmount = validation.amount;

    // 2. Fetch beneficiary and campaign
    const beneficiary = queryOne('SELECT * FROM beneficiaries WHERE id = ?', [beneficiaryId]);
    if (!beneficiary) {
      throw new Error('Beneficiary not found');
    }

    if (beneficiary.status !== 'VERIFIED' && !beneficiary.is_team_fund) {
      throw new Error('This beneficiary is not yet verified for public donations');
    }

    const campaign = queryOne('SELECT * FROM campaigns WHERE beneficiary_id = ? ORDER BY id DESC LIMIT 1', [beneficiaryId]);
    const campaignId = campaign ? campaign.id : null;

    // 3. Ensure user record exists
    let user = queryOne('SELECT * FROM users WHERE telegram_id = ?', [String(telegramId)]);
    const now = new Date().toISOString();
    if (!user) {
      execute(
        `INSERT INTO users (telegram_id, language, total_donated, donation_count, created_at, updated_at)
         VALUES (?, 'km', 0, 0, ?, ?)`,
        [String(telegramId), now, now]
      );
      user = queryOne('SELECT * FROM users WHERE telegram_id = ?', [String(telegramId)]);
    }

    // 4. Generate unique identifiers
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    const donationCode = `KHK-${randomHex}`;
    const transactionId = `TX-${Date.now()}-${randomHex}`;
    const idempotencyKey = `IDEM-${transactionId}`;

    const activeProvider = this.getProvider(providerName);

    // 5. Create database records in PENDING state
    transaction(() => {
      execute(
        `INSERT INTO donations (
          donation_code, user_id, telegram_id, beneficiary_id, campaign_id,
          amount, currency, status, payment_provider, transaction_id,
          donor_note, is_anonymous, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?)`,
        [
          donationCode,
          user ? user.id : null,
          String(telegramId),
          beneficiary.id,
          campaignId,
          cleanAmount,
          currency,
          activeProvider.name,
          transactionId,
          donorNote || null,
          isAnonymous ? 1 : 0,
          now,
          now,
        ]
      );

      const donation = queryOne('SELECT id FROM donations WHERE transaction_id = ?', [transactionId]);

      execute(
        `INSERT INTO payment_transactions (
          donation_id, transaction_id, idempotency_key, provider, amount, currency, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
        [
          donation.id,
          transactionId,
          idempotencyKey,
          activeProvider.name,
          cleanAmount,
          currency,
          now,
          now,
        ]
      );
    });

    // 6. Invoke provider to create session / QR
    const session = await activeProvider.createPaymentSession({
      transactionId,
      donationCode,
      amount: cleanAmount,
      currency,
      beneficiaryName: beneficiary.full_name,
      description: `Donation to ${beneficiary.full_name}`,
    });

    // 7. Update payment URL in donation record
    if (session.paymentUrl) {
      execute('UPDATE donations SET payment_url = ? WHERE transaction_id = ?', [session.paymentUrl, transactionId]);
    }

    const createdDonation = queryOne('SELECT * FROM donations WHERE transaction_id = ?', [transactionId]);

    // 8. Log audit trail
    logAudit({
      actorType: 'DONOR',
      actorId: String(telegramId),
      action: 'DONATION_INITIATED',
      entityType: 'donation',
      entityId: createdDonation.id,
      details: { amount: cleanAmount, transactionId, provider: activeProvider.name, beneficiaryId: beneficiary.id },
    });

    return {
      donation: createdDonation,
      beneficiary,
      campaign,
      session,
      provider: activeProvider.name,
    };
  }

  /**
   * Process payment success with idempotency and atomic updates
   */
  async processPaymentSuccess({ transactionId, providerTxId = null, rawPayload = {}, ipAddress = null }) {
    const existingDonation = queryOne('SELECT * FROM donations WHERE transaction_id = ?', [transactionId]);
    if (!existingDonation) {
      throw new Error(`Donation not found for transaction: ${transactionId}`);
    }

    // IDEMPOTENCY GUARD: If already marked PAID, return without double-counting
    if (existingDonation.status === 'PAID') {
      console.log(`[PaymentService] Idempotency notice: Transaction ${transactionId} already processed.`);
      const beneficiary = queryOne('SELECT * FROM beneficiaries WHERE id = ?', [existingDonation.beneficiary_id]);
      return { success: true, donation: existingDonation, beneficiary, alreadyProcessed: true };
    }

    const now = new Date().toISOString();
    let targetReached = false;
    let updatedCampaign = null;
    let beneficiary = null;

    // ATOMIC DATABASE TRANSACTION
    transaction(() => {
      // 1. Mark donation as PAID
      execute(
        `UPDATE donations
         SET status = 'PAID', paid_at = ?, updated_at = ?
         WHERE id = ?`,
        [now, now, existingDonation.id]
      );

      // 2. Mark payment transaction as PAID
      execute(
        `UPDATE payment_transactions
         SET status = 'PAID', provider_tx_id = ?, raw_payload = ?, updated_at = ?
         WHERE transaction_id = ?`,
        [providerTxId || null, JSON.stringify(rawPayload), now, transactionId]
      );

      // 3. Increment beneficiary amount_received
      execute(
        `UPDATE beneficiaries
         SET amount_received = amount_received + ?, updated_at = ?
         WHERE id = ?`,
        [existingDonation.amount, now, existingDonation.beneficiary_id]
      );

      beneficiary = queryOne('SELECT * FROM beneficiaries WHERE id = ?', [existingDonation.beneficiary_id]);

      // 4. Update campaign if exists
      if (existingDonation.campaign_id) {
        execute(
          `UPDATE campaigns
           SET current_amount = current_amount + ?, updated_at = ?
           WHERE id = ?`,
          [existingDonation.amount, now, existingDonation.campaign_id]
        );

        updatedCampaign = queryOne('SELECT * FROM campaigns WHERE id = ?', [existingDonation.campaign_id]);
        if (updatedCampaign && updatedCampaign.current_amount >= updatedCampaign.target_amount && updatedCampaign.status === 'ACTIVE') {
          execute("UPDATE campaigns SET status = 'TARGET_REACHED', updated_at = ? WHERE id = ?", [now, updatedCampaign.id]);
          updatedCampaign.status = 'TARGET_REACHED';
          targetReached = true;
        }
      }

      // 5. Update donor stats
      execute(
        `UPDATE users
         SET total_donated = total_donated + ?, donation_count = donation_count + 1, updated_at = ?
         WHERE telegram_id = ?`,
        [existingDonation.amount, now, existingDonation.telegram_id]
      );
    });

    const finalDonation = queryOne('SELECT * FROM donations WHERE id = ?', [existingDonation.id]);
    const donorUser = queryOne('SELECT * FROM users WHERE telegram_id = ?', [existingDonation.telegram_id]);
    const userLang = donorUser?.language || 'km';

    // 6. Record immutable audit log
    logAudit({
      actorType: 'WEBHOOK',
      actorId: providerTxId || transactionId,
      action: 'PAYMENT_RECEIVED',
      entityType: 'donation',
      entityId: finalDonation.id,
      details: {
        amount: finalDonation.amount,
        transactionId,
        providerTxId,
        beneficiaryId: finalDonation.beneficiary_id,
        targetReached,
      },
      ipAddress,
    });

    // 7. Dispatch notifications
    notifier.notifyDonationSuccess({
      donation: finalDonation,
      beneficiary,
      userLang,
    }).catch(err => console.error('[PaymentService] Receipt notification error:', err.message));

    if (targetReached && updatedCampaign) {
      notifier.notifyTargetReached({ campaign: updatedCampaign, beneficiary });
    }

    return {
      success: true,
      donation: finalDonation,
      beneficiary,
      campaign: updatedCampaign,
      targetReached,
      alreadyProcessed: false,
    };
  }

  /**
   * Process payment failure
   */
  async processPaymentFailure({ transactionId, reason = 'Failed', rawPayload = {} }) {
    const donation = queryOne('SELECT * FROM donations WHERE transaction_id = ?', [transactionId]);
    if (!donation) return;

    if (donation.status === 'PAID') {
      console.warn(`[PaymentService] Cannot fail already paid donation: ${transactionId}`);
      return;
    }

    const now = new Date().toISOString();
    execute("UPDATE donations SET status = 'FAILED', updated_at = ? WHERE id = ?", [now, donation.id]);
    execute("UPDATE payment_transactions SET status = 'FAILED', raw_payload = ?, updated_at = ? WHERE transaction_id = ?", [
      JSON.stringify(rawPayload),
      now,
      transactionId,
    ]);

    logAudit({
      actorType: 'WEBHOOK',
      actorId: transactionId,
      action: 'PAYMENT_FAILED',
      entityType: 'donation',
      entityId: donation.id,
      details: { reason, transactionId },
    });

    const beneficiary = queryOne('SELECT * FROM beneficiaries WHERE id = ?', [donation.beneficiary_id]);
    notifier.notifyDonationFailed({ donation, beneficiary, reason });
  }

  /**
   * Retrieve donation by transaction ID
   */
  getDonationByTransactionId(txId) {
    return queryOne(
      `SELECT d.*, b.full_name as beneficiary_name, b.full_name_km as beneficiary_name_km, b.category
       FROM donations d
       LEFT JOIN beneficiaries b ON d.beneficiary_id = b.id
       WHERE d.transaction_id = ?`,
      [txId]
    );
  }

  /**
   * Summary for a donor's /my_donations screen
   */
  getUserDonationSummary(telegramId) {
    const user = queryOne('SELECT * FROM users WHERE telegram_id = ?', [String(telegramId)]);
    const latest = queryOne(
      `SELECT d.*, b.full_name as beneficiary_name, b.full_name_km as beneficiary_name_km
       FROM donations d
       LEFT JOIN beneficiaries b ON d.beneficiary_id = b.id
       WHERE d.telegram_id = ? AND d.status = 'PAID'
       ORDER BY d.id DESC LIMIT 1`,
      [String(telegramId)]
    );

    return {
      totalDonated: user ? user.total_donated : 0.0,
      donationCount: user ? user.donation_count : 0,
      latest,
    };
  }

  /**
   * Donor's donation history list
   */
  getUserDonations(telegramId, limit = 10, offset = 0) {
    return queryAll(
      `SELECT d.*, b.full_name as beneficiary_name, b.full_name_km as beneficiary_name_km, b.category
       FROM donations d
       LEFT JOIN beneficiaries b ON d.beneficiary_id = b.id
       WHERE d.telegram_id = ?
       ORDER BY d.id DESC
       LIMIT ? OFFSET ?`,
      [String(telegramId), limit, offset]
    );
  }
}

const paymentService = new PaymentService();
module.exports = paymentService;
