/**
 * Telegram Bot Update Dispatcher & Router
 */

const { telegramRateLimiter } = require('../core/security/rate_limiter');
const { handleStart } = require('./handlers/start_handler');
const { handleCategory } = require('./handlers/category_handler');
const { handleViewDetails } = require('./handlers/beneficiary_handler');
const {
  promptAmountSelection,
  promptCustomAmount,
  handleCustomAmountInput,
  initiateDonation,
  getUserState,
} = require('./handlers/donation_handler');
const { handleTeamFund } = require('./handlers/team_fund_handler');
const { handleMyDonations, handleDonationHistory, handleCheckStatus } = require('./handlers/my_donations_handler');
const { handleTransparency } = require('./handlers/transparency_handler');
const { promptLanguageSelection, handleSetLanguage } = require('./handlers/language_handler');
const { getUserLanguage, t } = require('./i18n');
const { getHomeKeyboard } = require('./keyboards');

class BotDispatcher {
  constructor(telegramClient) {
    this.client = telegramClient;
  }

  async dispatchUpdate(update) {
    if (!update) return;

    try {
      if (update.message) {
        await this.handleMessage(update.message);
      } else if (update.callback_query) {
        await this.handleCallbackQuery(update.callback_query);
      }
    } catch (err) {
      console.error('[BotDispatcher Uncaught Exception]:', err);
      const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
      if (chatId) {
        const lang = getUserLanguage(chatId);
        const friendlyError = lang === 'km'
          ? '⚠️ មានបញ្ហាបច្ចេកទេសមួយបានកើតឡើង។ ក្រុមការងារយើងត្រូវបានជូនដំណឹងរួចរាល់ហើយ។ សូមព្យាយាមម្តងទៀត។'
          : '⚠️ Something went wrong. Our team has been notified. Please try again.';
        await this.client.sendMessage(chatId, friendlyError, {
          reply_markup: getHomeKeyboard(lang),
        }).catch(() => {});
      }
    }
  }

  async handleMessage(msg) {
    const chatId = msg.chat?.id;
    if (!chatId) return;

    // Rate limiting check
    if (!telegramRateLimiter.isAllowed(chatId)) {
      return this.client.sendMessage(chatId, '⚠️ Too many requests. Please wait a moment before sending another message.');
    }

    const text = msg.text ? msg.text.trim() : '';

    // Check if user is currently in a state (e.g. typing a custom amount)
    const state = getUserState(chatId);
    if (state && state.action === 'AWAITING_CUSTOM_AMOUNT' && text && !text.startsWith('/')) {
      return handleCustomAmountInput(this.client, msg, state);
    }

    const lang = getUserLanguage(chatId);

    // Command handling
    if (text.startsWith('/start')) {
      return handleStart(this.client, msg);
    }

    if (text.startsWith('/help') || text.startsWith('/about')) {
      return this.client.sendMessage(chatId, t(lang, 'aboutText'), {
        parse_mode: 'HTML',
        reply_markup: getHomeKeyboard(lang),
      });
    }

    if (text.startsWith('/contact')) {
      return this.client.sendMessage(chatId, t(lang, 'contactText'), {
        parse_mode: 'HTML',
        reply_markup: getHomeKeyboard(lang),
      });
    }

    if (text.startsWith('/transparency')) {
      return handleTransparency(this.client, { message: { chat: { id: chatId } }, id: 'manual' });
    }

    // Default message fallback: show home menu
    return handleStart(this.client, msg);
  }

  async handleCallbackQuery(query) {
    const chatId = query.message?.chat?.id;
    const data = query.data;
    if (!chatId || !data) return;

    // Rate limiting check
    if (!telegramRateLimiter.isAllowed(chatId)) {
      return this.client.answerCallbackQuery(query.id, {
        text: 'Please slow down a moment.',
        show_alert: true,
      });
    }

    const lang = getUserLanguage(chatId);

    // Route callback actions
    if (data === 'nav_home') {
      await this.client.answerCallbackQuery(query.id);
      return handleStart(this.client, query.message);
    }

    if (data.startsWith('cat_')) {
      const category = data.replace('cat_', '');
      return handleCategory(this.client, query, category);
    }

    if (data.startsWith('view_')) {
      const beneficiaryId = parseInt(data.replace('view_', ''), 10);
      return handleViewDetails(this.client, query, beneficiaryId);
    }

    if (data.startsWith('donate_')) {
      const beneficiaryId = parseInt(data.replace('donate_', ''), 10);
      return promptAmountSelection(this.client, query, beneficiaryId);
    }

    if (data.startsWith('amt_')) {
      const parts = data.split('_'); // amt_<id>_<amount>
      const beneficiaryId = parseInt(parts[1], 10);
      const amount = parseFloat(parts[2]);
      await this.client.answerCallbackQuery(query.id);
      return initiateDonation(this.client, chatId, beneficiaryId, amount);
    }

    if (data.startsWith('custom_')) {
      const beneficiaryId = parseInt(data.replace('custom_', ''), 10);
      return promptCustomAmount(this.client, query, beneficiaryId);
    }

    if (data === 'team_fund') {
      return handleTeamFund(this.client, query);
    }

    if (data === 'nav_my_donations') {
      return handleMyDonations(this.client, query);
    }

    if (data === 'nav_history') {
      return handleDonationHistory(this.client, query);
    }

    if (data === 'nav_transparency') {
      return handleTransparency(this.client, query);
    }

    if (data === 'nav_language') {
      return promptLanguageSelection(this.client, query);
    }

    if (data.startsWith('setlang_')) {
      const langCode = data.replace('setlang_', '');
      return handleSetLanguage(this.client, query, langCode);
    }

    if (data === 'nav_about') {
      await this.client.answerCallbackQuery(query.id);
      return this.client.sendMessage(chatId, t(lang, 'aboutText'), {
        parse_mode: 'HTML',
        reply_markup: getHomeKeyboard(lang),
      });
    }

    if (data === 'nav_contact') {
      await this.client.answerCallbackQuery(query.id);
      return this.client.sendMessage(chatId, t(lang, 'contactText'), {
        parse_mode: 'HTML',
        reply_markup: getHomeKeyboard(lang),
      });
    }

    if (data.startsWith('checktx_')) {
      const txId = data.replace('checktx_', '');
      return handleCheckStatus(this.client, query, txId);
    }

    // Default callback answer
    return this.client.answerCallbackQuery(query.id);
  }
}

module.exports = BotDispatcher;
