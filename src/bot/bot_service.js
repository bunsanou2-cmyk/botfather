/**
 * Bot Service Lifecycle Manager
 * Supports both Webhook (Production) and Long-Polling (Development/Local).
 */

const config = require('../config');
const TelegramClient = require('./telegram_client');
const BotDispatcher = require('./bot_dispatcher');
const botRegistry = require('../core/multi_bot/bot_registry');
const notifier = require('../core/notifications/notifier');

class BotService {
  constructor() {
    this.name = 'Khmer Help Khmer Donation Bot';
    this.description = 'Transparent Cambodian donation platform connecting donors with verified beneficiaries.';
    this.client = new TelegramClient(config.telegram.token);
    this.dispatcher = new BotDispatcher(this.client);
    this.isPolling = false;
    this.pollOffset = 0;

    notifier.setTelegramClient(this.client);
    botRegistry.register('khmer_help_khmer', this);
  }

  verifyWebhookSecret(secretToken) {
    if (!config.telegram.webhookSecret) return true;
    return secretToken === config.telegram.webhookSecret;
  }

  async dispatchUpdate(update) {
    return this.dispatcher.dispatchUpdate(update);
  }

  async start() {
    if (!this.client.hasToken()) {
      console.log('------------------------------------------------------------');
      console.log('ℹ️  TELEGRAM_BOT_TOKEN is not set or using placeholder.');
      console.log('   The bot engine is running in SIMULATION & WEBHOOK mode.');
      console.log('   You can still test all flows via Web Checkout & Admin Dashboard.');
      console.log('   To connect Telegram, add your BotFather token to .env');
      console.log('------------------------------------------------------------');
      return;
    }

    try {
      const me = await this.client.getMe();
      if (me.ok) {
        console.log(`[BotService] Connected to Telegram as @${me.result.username} (${me.result.first_name})`);
      }
    } catch (err) {
      console.warn('[BotService] Notice: Could not connect to Telegram getMe():', err.message);
    }

    if (config.telegram.useWebhook) {
      const webhookUrl = `${config.appUrl}/webhook/telegram/khmer_help_khmer`;
      console.log(`[BotService] Configuring Telegram webhook: ${webhookUrl}`);
      try {
        const res = await this.client.setWebhook(webhookUrl, config.telegram.webhookSecret);
        if (res.ok) {
          console.log('[BotService] Webhook registered successfully with Telegram API.');
        } else {
          console.warn('[BotService] Webhook set failed:', res.description);
        }
      } catch (err) {
        console.error('[BotService] Webhook configuration error:', err.message);
      }
    } else {
      // Development mode: Long polling
      console.log('[BotService] Starting long polling for development...');
      this.isPolling = true;
      this.runPollingLoop();
    }
  }

  async runPollingLoop() {
    while (this.isPolling) {
      try {
        const updates = await this.client.getUpdates(this.pollOffset, 50, 10);
        if (updates.ok && Array.isArray(updates.result)) {
          for (const update of updates.result) {
            this.pollOffset = update.update_id + 1;
            await this.dispatcher.dispatchUpdate(update);
          }
        }
      } catch (err) {
        console.error('[BotService] Polling exception:', err.message);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  stop() {
    this.isPolling = false;
  }
}

const botService = new BotService();
module.exports = botService;
