/**
 * Multi-Bot Registry & Dispatcher
 * Allows multiple distinct Telegram bots (Donations, Job Marketplace, Tickets, Shop, etc.)
 * to share the same unified backend, user accounts, payments, and admin infrastructure.
 */

class BotRegistry {
  constructor() {
    this.bots = new Map();
  }

  /**
   * Register a bot instance
   * @param {string} id - Unique bot identifier (e.g. 'khmer_help_khmer', 'job_marketplace')
   * @param {Object} botInstance - Bot instance with dispatchUpdate() and client
   */
  register(id, botInstance) {
    if (this.bots.has(id)) {
      console.warn(`[BotRegistry] Overwriting registered bot: ${id}`);
    }
    this.bots.set(id, botInstance);
    console.log(`[BotRegistry] Bot registered: ${id}`);
  }

  get(id) {
    return this.bots.get(id);
  }

  getAll() {
    return Array.from(this.bots.entries()).map(([id, bot]) => ({
      id,
      name: bot.name || id,
      description: bot.description || '',
    }));
  }

  /**
   * Route incoming webhook to the matching bot
   */
  async handleWebhookUpdate(botId, update, secretToken) {
    const bot = this.bots.get(botId);
    if (!bot) {
      throw new Error(`Bot with ID '${botId}' is not registered`);
    }

    if (bot.verifyWebhookSecret && !bot.verifyWebhookSecret(secretToken)) {
      throw new Error('Unauthorized Telegram webhook secret');
    }

    return bot.dispatchUpdate(update);
  }
}

const botRegistry = new BotRegistry();
module.exports = botRegistry;
