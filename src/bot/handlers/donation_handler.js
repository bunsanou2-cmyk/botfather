/**
 * Donation Flow Handler
 * Handles preset selection, custom amount prompts, input validation (min $0.10),
 * session initialization, and confirmation display with secure payment button.
 */

const { queryOne } = require('../../core/db/database');
const paymentService = require('../../core/payments/payment_service');
const { getAmountSelectionKeyboard, getConfirmationKeyboard } = require('../keyboards');
const { getUserLanguage, t } = require('../i18n');
const { validateDonationAmount } = require('../../core/security/validator');

// Temporary in-memory state store for user interactions (e.g. typing custom amounts)
const userStates = new Map();

function setUserState(telegramId, state) {
  userStates.set(String(telegramId), { ...state, updatedAt: Date.now() });
}

function getUserState(telegramId) {
  return userStates.get(String(telegramId)) || null;
}

function clearUserState(telegramId) {
  userStates.delete(String(telegramId));
}

/**
 * Show amount selection keyboard
 */
async function promptAmountSelection(telegramClient, query, beneficiaryId) {
  const chatId = query.message.chat.id;
  const lang = getUserLanguage(chatId);

  const b = queryOne('SELECT * FROM beneficiaries WHERE id = ?', [beneficiaryId]);
  if (!b) {
    return telegramClient.answerCallbackQuery(query.id, { text: 'Beneficiary not found' });
  }

  await telegramClient.answerCallbackQuery(query.id);

  const name = lang === 'km' && b.full_name_km ? b.full_name_km : b.full_name;

  const text = `
❤️ <b>${t(lang, 'confirmDonationTitle')}</b>
👤 <b>${t(lang, 'confirmBeneficiary')}</b> ${name}

${t(lang, 'chooseAmountTitle')}
${t(lang, 'minDonationNotice')}
`.trim();

  await telegramClient.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: getAmountSelectionKeyboard(b.id, lang),
  });
}

/**
 * Prompt user to enter custom amount
 */
async function promptCustomAmount(telegramClient, query, beneficiaryId) {
  const chatId = query.message.chat.id;
  const lang = getUserLanguage(chatId);

  setUserState(chatId, {
    action: 'AWAITING_CUSTOM_AMOUNT',
    beneficiaryId,
  });

  await telegramClient.answerCallbackQuery(query.id);

  const promptText = `${t(lang, 'customAmountPrompt')}\n\n${t(lang, 'minDonationNotice')}`;

  await telegramClient.sendMessage(chatId, promptText, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[{ text: t(lang, 'btnCancel'), callback_data: `view_${beneficiaryId}` }]],
    },
  });
}

/**
 * Handle incoming text when user is in AWAITING_CUSTOM_AMOUNT state
 */
async function handleCustomAmountInput(telegramClient, msg, state) {
  const chatId = msg.chat.id;
  const lang = getUserLanguage(chatId);
  const text = msg.text ? msg.text.trim() : '';

  const validation = validateDonationAmount(text);
  if (!validation.valid) {
    return telegramClient.sendMessage(chatId, `${validation.error}\n\n${t(lang, 'customAmountPrompt')}`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: t(lang, 'btnCancel'), callback_data: `view_${state.beneficiaryId}` }]],
      },
    });
  }

  // Clear state and proceed to checkout confirmation
  clearUserState(chatId);
  await initiateDonation(telegramClient, chatId, state.beneficiaryId, validation.amount);
}

/**
 * Initiates donation session and sends confirmation card with payment link
 */
async function initiateDonation(telegramClient, chatId, beneficiaryId, amount) {
  const lang = getUserLanguage(chatId);

  try {
    const result = await paymentService.createDonationSession({
      telegramId: chatId,
      beneficiaryId,
      amount,
    });

    const { donation, beneficiary, session } = result;
    const name = lang === 'km' && beneficiary.full_name_km ? beneficiary.full_name_km : beneficiary.full_name;

    const confirmationText = `
━━━━━━━━━━━━━━━━━━━━
❤️ <b>${t(lang, 'confirmDonationTitle')}</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>${t(lang, 'confirmBeneficiary')}</b> ${name}
💰 <b>${t(lang, 'confirmAmount')}</b> <b>$${donation.amount.toFixed(2)} USD</b>
🆔 <b>Donation Code:</b> <code>${donation.donation_code}</code>
📑 <b>Transaction ID:</b> <code>${donation.transaction_id}</code>

${session.instructions ? `ℹ️ <i>${session.instructions}</i>\n` : ''}
${t(lang, 'confirmNotice')}
━━━━━━━━━━━━━━━━━━━━
`.trim();

    await telegramClient.sendMessage(chatId, confirmationText, {
      parse_mode: 'HTML',
      reply_markup: getConfirmationKeyboard(session.paymentUrl, donation.transaction_id, beneficiary.id, lang),
    });
  } catch (err) {
    console.error('[DonationHandler] Session creation failed:', err.message);
    await telegramClient.sendMessage(chatId, `⚠️ ${err.message || 'Payment session could not be created. Please try again.'}`, {
      reply_markup: {
        inline_keyboard: [[{ text: t(lang, 'btnBackHome'), callback_data: 'nav_home' }]],
      },
    });
  }
}

module.exports = {
  promptAmountSelection,
  promptCustomAmount,
  handleCustomAmountInput,
  initiateDonation,
  getUserState,
  clearUserState,
};
