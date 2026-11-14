/**
 * Internationalization (i18n) Engine
 */

const km = require('./km');
const en = require('./en');
const { queryOne, execute } = require('../../core/db/database');

const languages = { km, en };

function getUserLanguage(telegramId) {
  const user = queryOne('SELECT language FROM users WHERE telegram_id = ?', [String(telegramId)]);
  return user?.language === 'en' ? 'en' : 'km';
}

function setUserLanguage(telegramId, lang) {
  const cleanLang = lang === 'en' ? 'en' : 'km';
  const now = new Date().toISOString();
  const existing = queryOne('SELECT id FROM users WHERE telegram_id = ?', [String(telegramId)]);
  if (existing) {
    execute('UPDATE users SET language = ?, updated_at = ? WHERE telegram_id = ?', [cleanLang, now, String(telegramId)]);
  } else {
    execute(
      'INSERT INTO users (telegram_id, language, total_donated, donation_count, created_at, updated_at) VALUES (?, ?, 0, 0, ?, ?)',
      [String(telegramId), cleanLang, now, now]
    );
  }
  return cleanLang;
}

function t(lang, key) {
  const activeLang = languages[lang] || languages.km;
  return activeLang[key] || languages.en[key] || key;
}

module.exports = {
  getUserLanguage,
  setUserLanguage,
  t,
  languages,
};
