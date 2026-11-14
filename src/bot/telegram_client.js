/**
 * Telegram Bot API HTTP Client
 * Built on native fetch without external dependencies.
 */

class TelegramClient {
  constructor(token) {
    this.token = token;
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  hasToken() {
    return Boolean(this.token && this.token.length > 10 && !this.token.includes('placeholder'));
  }

  async callApi(method, body = {}) {
    if (!this.hasToken()) {
      console.log(`[TelegramClient Simulation] Call to '${method}':`, JSON.stringify(body).slice(0, 150));
      return { ok: true, result: { message_id: Math.floor(Math.random() * 100000) } };
    }

    const url = `${this.baseUrl}/${method}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.ok) {
        console.error(`[TelegramClient Error] ${method} failed:`, data.description);
      }
      return data;
    } catch (err) {
      console.error(`[TelegramClient Network Error] ${method}:`, err.message);
      return { ok: false, error: err.message };
    }
  }

  async sendMessage(chatId, text, options = {}) {
    return this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      ...options,
    });
  }

  async sendPhoto(chatId, photo, options = {}) {
    return this.callApi('sendPhoto', {
      chat_id: chatId,
      photo,
      ...options,
    });
  }

  async editMessageText(chatId, messageId, text, options = {}) {
    return this.callApi('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      ...options,
    });
  }

  async answerCallbackQuery(callbackQueryId, options = {}) {
    return this.callApi('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      ...options,
    });
  }

  async setWebhook(url, secretToken) {
    return this.callApi('setWebhook', {
      url,
      secret_token: secretToken,
      drop_pending_updates: false,
    });
  }

  async deleteWebhook() {
    return this.callApi('deleteWebhook');
  }

  async getMe() {
    return this.callApi('getMe');
  }

  async getUpdates(offset = 0, limit = 100, timeout = 25) {
    if (!this.hasToken()) return { ok: true, result: [] };
    const url = `${this.baseUrl}/getUpdates?offset=${offset}&limit=${limit}&timeout=${timeout}`;
    try {
      const res = await fetch(url);
      return await res.json();
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}

module.exports = TelegramClient;
