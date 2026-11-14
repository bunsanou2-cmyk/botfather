/**
 * My Donations & Donation History Handlers
 */

const paymentService = require('../../core/payments/payment_service');
const { queryOne } = require('../../core/db/database');
const { getUserLanguage, t } = require('../i18n');

async function handleMyDonations(telegramClient, query) {
  const chatId = query.message.chat.id;
  const lang = getUserLanguage(chatId);

  await telegramClient.answerCallbackQuery(query.id);

  const summary = paymentService.getUserDonationSummary(chatId);

  let latestText = lang === 'km' ? 'មិនទាន់មាន' : 'None yet';
  if (summary.latest) {
    const benName = lang === 'km' && summary.latest.beneficiary_name_km
      ? summary.latest.beneficiary_name_km
      : summary.latest.beneficiary_name;
    latestText = `$${summary.latest.amount.toFixed(2)} → <b>${benName}</b>`;
  }

  const text = `
━━━━━━━━━━━━━━━━━━━━━━
<b>${t(lang, 'myDonationSummaryTitle')}</b>
━━━━━━━━━━━━━━━━━━━━━━

${t(lang, 'totalDonated')}
<b>$${summary.totalDonated.toFixed(2)} USD</b>

${t(lang, 'donationCount')}
<b>${summary.donationCount}</b>

${t(lang, 'latestDonation')}
${latestText}

━━━━━━━━━━━━━━━━━━━━━━
<i>${t(lang, 'slogan')}</i>
`.trim();

  const keyboard = {
    inline_keyboard: [
      [{ text: t(lang, 'btnHistory'), callback_data: 'nav_history' }],
      [{ text: t(lang, 'btnBackHome'), callback_data: 'nav_home' }],
    ],
  };

  await telegramClient.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

async function handleDonationHistory(telegramClient, query) {
  const chatId = query.message.chat.id;
  const lang = getUserLanguage(chatId);

  await telegramClient.answerCallbackQuery(query.id);

  const donations = paymentService.getUserDonations(chatId, 10, 0);

  if (!donations || donations.length === 0) {
    return telegramClient.sendMessage(chatId, `📜 <b>${t(lang, 'btnHistory')}</b>\n\n${t(lang, 'noDonationsYet')}`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: t(lang, 'btnBackHome'), callback_data: 'nav_home' }]],
      },
    });
  }

  const lines = donations.map((d, index) => {
    const benName = lang === 'km' && d.beneficiary_name_km ? d.beneficiary_name_km : d.beneficiary_name;
    const date = new Date(d.created_at).toLocaleDateString('en-GB');
    const statusIcon = d.status === 'PAID' ? '✅' : (d.status === 'PENDING' ? '⏳' : '❌');
    return `${index + 1}. ${statusIcon} <b>$${d.amount.toFixed(2)}</b> → ${benName}\n   📅 ${date} | 📑 <code>${d.transaction_id}</code>`;
  });

  const text = `
📜 <b>${t(lang, 'btnHistory')}</b>
━━━━━━━━━━━━━━━━━━━━━━
${lines.join('\n\n')}
━━━━━━━━━━━━━━━━━━━━━━
`.trim();

  const keyboard = {
    inline_keyboard: [
      [{ text: t(lang, 'btnBackHome'), callback_data: 'nav_home' }],
    ],
  };

  await telegramClient.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

/**
 * Check payment status of a transaction from Telegram
 */
async function handleCheckStatus(telegramClient, query, transactionId) {
  const chatId = query.message.chat.id;
  const lang = getUserLanguage(chatId);

  const donation = paymentService.getDonationByTransactionId(transactionId);
  if (!donation) {
    return telegramClient.answerCallbackQuery(query.id, { text: 'Transaction not found' });
  }

  await telegramClient.answerCallbackQuery(query.id);

  if (donation.status === 'PAID') {
    const ben = queryOne('SELECT * FROM beneficiaries WHERE id = ?', [donation.beneficiary_id]);
    await telegramClient.sendMessage(chatId, `✅ <b>Payment Confirmed!</b>\nTransaction <code>${transactionId}</code> is PAID. Thank you for your support!`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: t(lang, 'btnBackHome'), callback_data: 'nav_home' }]],
      },
    });
  } else {
    await telegramClient.sendMessage(chatId, `⏳ <b>Status: ${donation.status}</b>\nTransaction <code>${transactionId}</code> is still pending payment verification.`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Refresh Status', callback_data: `checktx_${transactionId}` }],
          [{ text: '💳 Open Checkout', url: donation.payment_url || '#' }],
          [{ text: t(lang, 'btnBackHome'), callback_data: 'nav_home' }],
        ],
      },
    });
  }
}

module.exports = {
  handleMyDonations,
  handleDonationHistory,
  handleCheckStatus,
};
