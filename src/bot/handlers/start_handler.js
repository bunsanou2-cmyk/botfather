/**
 * Start & Welcome Handler
 */

const { getHomeKeyboard } = require('../keyboards');
const { getUserLanguage, t } = require('../i18n');

async function handleStart(telegramClient, msg) {
  const chatId = msg.chat.id;
  const lang = getUserLanguage(chatId);

  const bannerUrl = 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1200&q=80';

  const caption = `
<b>${t(lang, 'welcomeTitle')}</b>
<i>${t(lang, 'slogan')}</i>

${t(lang, 'welcomeDescription')}
`.trim();

  // Try sending with banner image, fallback to text
  try {
    await telegramClient.sendPhoto(chatId, bannerUrl, {
      caption,
      parse_mode: 'HTML',
      reply_markup: getHomeKeyboard(lang),
    });
  } catch (_) {
    await telegramClient.sendMessage(chatId, caption, {
      parse_mode: 'HTML',
      reply_markup: getHomeKeyboard(lang),
    });
  }
}

module.exports = {
  handleStart,
};
