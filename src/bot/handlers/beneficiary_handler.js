/**
 * Beneficiary Details Handler
 * Shows complete verified profile, full story, target, progress bar,
 * recent donations, and [DONATE NOW] action without exposing private documents.
 */

const { queryOne, queryAll } = require('../../core/db/database');
const { getBeneficiaryDetailKeyboard } = require('../keyboards');
const { renderProgressBar, calculateProgress } = require('../helpers');
const { getUserLanguage, t } = require('../i18n');

async function handleViewDetails(telegramClient, query, beneficiaryId) {
  const chatId = query.message.chat.id;
  const lang = getUserLanguage(chatId);

  const b = queryOne('SELECT * FROM beneficiaries WHERE id = ?', [beneficiaryId]);
  if (!b) {
    return telegramClient.answerCallbackQuery(query.id, { text: 'Beneficiary not found' });
  }

  await telegramClient.answerCallbackQuery(query.id);

  const { progress, remaining } = calculateProgress(b.amount_needed, b.amount_received);
  const progressBar = renderProgressBar(progress, 14);

  const name = lang === 'km' && b.full_name_km ? b.full_name_km : b.full_name;
  const location = lang === 'km' && b.location_km ? b.location_km : b.location;
  const situation = lang === 'km' && b.current_situation_km ? b.current_situation_km : b.current_situation;
  const story = lang === 'km' && b.story_km ? b.story_km : b.story;

  // Recent 3 verified donations summary
  const recentDonations = queryAll(
    `SELECT amount, paid_at, is_anonymous
     FROM donations
     WHERE beneficiary_id = ? AND status = 'PAID'
     ORDER BY id DESC LIMIT 3`,
    [b.id]
  );

  let recentSummary = '';
  if (recentDonations.length > 0) {
    const list = recentDonations
      .map(d => `• $${d.amount.toFixed(2)} (${d.is_anonymous ? 'Anonymous' : 'Donor'})`)
      .join('\n');
    recentSummary = `\n<b>Recent Verified Contributions:</b>\n${list}\n`;
  }

  const badge = b.verification_badge ? '✅ <b>[VERIFIED / បានផ្ទៀងផ្ទាត់]</b>\n' : '';

  const detailsText = `
${badge}<b>${name}</b>
🎂 <b>${t(lang, 'labelAge')}</b> ${b.age || 'N/A'}
📍 <b>${t(lang, 'labelLocation')}</b> ${location}

<b>${t(lang, 'labelSituation')}</b>
${situation}

<b>${t(lang, 'labelStory')}</b>
${story}

━━━━━━━━━━━━━━━━
💰 <b>${t(lang, 'labelNeeded')}</b> $${b.amount_needed.toLocaleString()} USD
❤️ <b>${t(lang, 'labelReceived')}</b> $${b.amount_received.toLocaleString()} USD
⏳ <b>${t(lang, 'labelRemaining')}</b> $${remaining.toLocaleString()} USD
📊 <b>${t(lang, 'labelProgress')}</b>
<code>${progressBar}</code>
━━━━━━━━━━━━━━━━
${recentSummary}
`.trim();

  const keyboard = getBeneficiaryDetailKeyboard(b.id, b.category, lang);

  if (b.profile_image_url) {
    try {
      await telegramClient.sendPhoto(chatId, b.profile_image_url, {
        caption: detailsText,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
      return;
    } catch (_) {}
  }

  await telegramClient.sendMessage(chatId, detailsText, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

module.exports = {
  handleViewDetails,
};
