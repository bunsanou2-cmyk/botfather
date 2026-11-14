/**
 * Secure Webhook Controller
 * Handles Telegram Bot updates and Payment Gateway Webhook callbacks.
 * Enforces signature checks and prevents replay/duplicate attacks.
 */

const botRegistry = require('../../core/multi_bot/bot_registry');
const paymentService = require('../../core/payments/payment_service');
const { parseJsonBody, sendJson } = require('../router');

async function handleTelegramWebhook(req, res) {
  const botId = req.params.botId || 'khmer_help_khmer';
  const secretHeader = req.headers['x-telegram-bot-api-secret-token'];

  try {
    const update = await parseJsonBody(req);
    await botRegistry.handleWebhookUpdate(botId, update, secretHeader);
    sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error(`[Webhook Error] Telegram bot '${botId}':`, err.message);
    if (err.message.includes('Unauthorized')) {
      return sendJson(res, 401, { error: 'Unauthorized secret token' });
    }
    sendJson(res, 200, { ok: false, error: err.message }); // Always return 200 to Telegram unless auth error
  }
}

async function handlePaymentWebhook(req, res) {
  const providerName = req.params.provider;
  const provider = paymentService.getProvider(providerName);

  if (!provider) {
    return sendJson(res, 404, { success: false, error: 'Payment provider not found' });
  }

  try {
    const rawBody = await parseJsonBody(req);
    const verification = await provider.verifyWebhook(req.headers, rawBody);

    if (!verification.isValid) {
      console.warn(`[PaymentWebhook] Signature verification failed for ${providerName}:`, verification.error);
      return sendJson(res, 401, { success: false, error: verification.error || 'Invalid signature' });
    }

    const { transactionId, providerTxId, status, rawPayload } = verification;

    if (status === 'PAID') {
      const result = await paymentService.processPaymentSuccess({
        transactionId,
        providerTxId,
        rawPayload,
        ipAddress: req.socket.remoteAddress,
      });

      return sendJson(res, 200, {
        success: true,
        transactionId,
        alreadyProcessed: result.alreadyProcessed,
      });
    } else {
      await paymentService.processPaymentFailure({
        transactionId,
        reason: 'Payment failed or cancelled at gateway',
        rawPayload,
      });

      return sendJson(res, 200, { success: true, status: 'FAILED' });
    }
  } catch (err) {
    console.error('[PaymentWebhook] Exception processing callback:', err);
    sendJson(res, 500, { success: false, error: err.message });
  }
}

module.exports = {
  handleTelegramWebhook,
  handlePaymentWebhook,
};
