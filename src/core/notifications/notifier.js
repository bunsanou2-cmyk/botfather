/**
 * Notification Dispatcher
 * Dispatches Telegram notifications to donors and administrators.
 */

const config = require('../../config');
const { formatReceiptText } = require('../payments/receipt_generator');

let telegramClientRef = null;

function setTelegramClient(client) {
  telegramClientRef = client;
}

/**
 * Send receipt and thank-you notification to donor
 */
async function notifyDonationSuccess({ donation, beneficiary, userLang = 'km' }) {
  if (!donation.telegram_id || !telegramClientRef) {
    console.log(`[Notifier] Dev notice: Donation success for Telegram ID ${donation.telegram_id}, Amount $${donation.amount}`);
    return;
  }

  const receiptText = formatReceiptText({ donation, beneficiary, userLang });
  const keyboard = {
    inline_keyboard: [
      [
        {
          text: userLang === 'km' ? '📜 មើលប្រវត្តិបរិច្ចាគ' : '📜 View Donation History',
          callback_data: 'nav_history',
        },
      ],
      [
        {
          text: userLang === 'km' ? '🏠 ត្រឡប់ទៅទំព័រដើម' : '🏠 Back to Home',
          callback_data: 'nav_home',
        },
      ],
    ],
  };

  try {
    await telegramClientRef.sendMessage(donation.telegram_id, receiptText, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (err) {
    console.error(`[Notifier] Failed to send receipt to ${donation.telegram_id}:`, err.message);
  }
}

/**
 * Notify donor if payment failed or was cancelled
 */
async function notifyDonationFailed({ donation, beneficiary, reason = 'Payment could not be completed' }) {
  if (!donation.telegram_id || !telegramClientRef) return;

  const text = `
❌ <b>Payment Notice / សេចក្តីជូនដំណឹងការទូទាត់</b>
Donation of <b>$${donation.amount.toFixed(2)}</b> for <b>${beneficiary?.full_name || 'Campaign'}</b> could not be completed.
Reason: <i>${reason}</i>
You may try again at any time. Thank you for your kindness!
`.trim();

  try {
    await telegramClientRef.sendMessage(donation.telegram_id, text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Try Again', callback_data: `donate_${donation.beneficiary_id}` }],
          [{ text: '🏠 Home', callback_data: 'nav_home' }],
        ],
      },
    });
  } catch (err) {
    console.error(`[Notifier] Failed to send failure alert to ${donation.telegram_id}:`, err.message);
  }
}

/**
 * Notify when a campaign reaches 100% of its fundraising target
 */
async function notifyTargetReached({ campaign, beneficiary }) {
  console.log(`[Notifier] 🎉 TARGET REACHED: ${beneficiary.full_name} reached $${campaign.current_amount} / $${campaign.target_amount}`);
  // In production, can notify admin telegram group or public channel
}

module.exports = {
  setTelegramClient,
  notifyDonationSuccess,
  notifyDonationFailed,
  notifyTargetReached,
};
