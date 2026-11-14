/**
 * Category Listing Handler
 * Displays verified beneficiaries as rich cards with photos and progress.
 */

const { queryAll } = require('../../core/db/database');
const { getBeneficiaryCardKeyboard } = require('../keyboards');
const { calculateProgress } = require('../helpers');
const { getUserLanguage, t } = require('../i18n');

const CATEGORY_HEADERS = {
  sick: { km: '❤️ ជួយអ្នកជំងឺ (HELP SICK PEOPLE)', en: '❤️ HELP SICK PEOPLE' },
  student: { km: '🎓 ជួយសិស្ស និស្សិត (HELP STUDENTS)', en: '🎓 HELP STUDENTS' },
  elderly: { km: '👵 ជួយមនុស្សចាស់ (HELP ELDERLY PEOPLE)', en: '👵 HELP ELDERLY PEOPLE' },
};

async function handleCategory(telegramClient, query, category) {
  const chatId = query.message.chat.id;
  const lang = getUserLanguage(chatId);

  const beneficiaries = queryAll(
    `SELECT * FROM beneficiaries
     WHERE category = ? AND status = 'VERIFIED' AND is_team_fund = 0
     ORDER BY id ASC`,
    [category]
  );

  const header = CATEGORY_HEADERS[category] ? (CATEGORY_HEADERS[category][lang] || CATEGORY_HEADERS[category].en) : 'BENEFICIARIES';

  if (!beneficiaries || beneficiaries.length === 0) {
    const emptyNotice = lang === 'km'
      ? `បច្ចុប្បន្នមិនទាន់មានករណីក្នុងជំពូកនេះដែលកំពុងរង់ចាំជំនួយទេ។ សូមពិនិត្យមើលជំពូកផ្សេងទៀត។`
      : `There are currently no active cases in this category. Please check other categories.`;

    return telegramClient.sendMessage(chatId, `<b>${header}</b>\n\n${emptyNotice}`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: t(lang, 'btnBackHome'), callback_data: 'nav_home' }]],
      },
    });
  }

  // Answer callback query first to stop spinner
  await telegramClient.answerCallbackQuery(query.id);

  for (const b of beneficiaries) {
    const { progress, remaining } = calculateProgress(b.amount_needed, b.amount_received);
    const name = lang === 'km' && b.full_name_km ? b.full_name_km : b.full_name;
    const location = lang === 'km' && b.location_km ? b.location_km : b.location;
    const situation = lang === 'km' && b.current_situation_km ? b.current_situation_km : b.current_situation;
    const shortDesc = lang === 'km' && b.short_description_km ? b.short_description_km : (b.short_description || '');

    const cardText = `
━━━━━━━━━━━━━━━━
<b>${header}</b>

${t(lang, 'labelName')} <b>${name}</b>
${t(lang, 'labelAge')} <b>${b.age || 'N/A'}</b>
${t(lang, 'labelLocation')} <b>${location}</b>

<b>${t(lang, 'labelSituation')}</b>
${situation}
${shortDesc ? `\n<i>${shortDesc}</i>` : ''}

${t(lang, 'labelNeeded')} <b>$${b.amount_needed.toLocaleString()}</b>
${t(lang, 'labelReceived')} <b>$${b.amount_received.toLocaleString()}</b>
${t(lang, 'labelRemaining')} <b>$${remaining.toLocaleString()}</b>
${t(lang, 'labelProgress')} <b>${progress}%</b>
━━━━━━━━━━━━━━━━
`.trim();

    const keyboard = getBeneficiaryCardKeyboard(b.id, category, lang);

    if (b.profile_image_url) {
      try {
        await telegramClient.sendPhoto(chatId, b.profile_image_url, {
          caption: cardText,
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
        continue;
      } catch (_) {
        // Fallback to text message if image fails to load
      }
    }

    await telegramClient.sendMessage(chatId, cardText, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  }
}

module.exports = {
  handleCategory,
};
