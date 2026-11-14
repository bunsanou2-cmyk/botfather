/**
 * Language Selection Handler
 */

const { setUserLanguage, t } = require('../i18n');
const { getLanguageKeyboard, getHomeKeyboard } = require('../keyboards');

async function promptLanguageSelection(telegramClient, query) {
  const chatId = query.message.chat.id;
  await telegramClient.answerCallbackQuery(query.id);

  await telegramClient.sendMessage(chatId, '🌐 <b>សូមជ្រើសរើសភាសា / Choose Language:</b>', {
    parse_mode: 'HTML',
    reply_markup: getLanguageKeyboard(),
  });
}

async function handleSetLanguage(telegramClient, query, langCode) {
  const chatId = query.message.chat.id;
  setUserLanguage(chatId, langCode);

  await telegramClient.answerCallbackQuery(query.id, {
    text: langCode === 'km' ? 'ភាសាត្រូវបានផ្លាស់ប្តូរទៅជា ភាសាខ្មែរ' : 'Language changed to English',
  });

  const confirmText = langCode === 'km'
    ? '✅ <b>ភាសាខ្មែរត្រូវបានជ្រើសរើសដោយជោគជ័យ!</b>'
    : '✅ <b>Language successfully updated to English!</b>';

  await telegramClient.sendMessage(chatId, confirmText, {
    parse_mode: 'HTML',
    reply_markup: getHomeKeyboard(langCode),
  });
}

module.exports = {
  promptLanguageSelection,
  handleSetLanguage,
};
