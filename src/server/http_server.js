/**
 * Native HTTP Server
 * Serves the Admin Dashboard, Public Transparency Portal, Checkout Simulator,
 * REST APIs, and Secure Webhook Receivers.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');
const { Router, sendJson } = require('./router');
const { httpRateLimiter } = require('../core/security/rate_limiter');

const authController = require('./controllers/auth_controller');
const adminController = require('./controllers/admin_controller');
const paymentController = require('./controllers/payment_controller');
const webhookController = require('./controllers/webhook_controller');
const publicController = require('./controllers/public_controller');

function createHttpServer() {
  const router = new Router();

  // 1. Health check
  router.get('/api/health', (req, res) => {
    sendJson(res, 200, {
      status: 'UP',
      app: 'Khmer Help Khmer',
      version: '1.0.0',
      mode: config.payment.mode,
      provider: config.payment.provider,
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    });
  });

  // 2. Authentication APIs
  router.post('/api/auth/login', authController.handleLogin);
  router.get('/api/auth/me', authController.handleGetMe);

  // 3. Admin Dashboard APIs
  router.get('/api/admin/dashboard', adminController.handleDashboardStats);
  router.get('/api/admin/beneficiaries', adminController.handleGetBeneficiaries);
  router.post('/api/admin/beneficiaries', adminController.handleCreateBeneficiary);
  router.post('/api/admin/beneficiaries/:id/status', adminController.handleUpdateBeneficiaryStatus);
  router.get('/api/admin/donations', adminController.handleGetDonations);
  router.get('/api/admin/donors', adminController.handleGetDonors);
  router.get('/api/admin/distributions', adminController.handleGetDistributions);
  router.post('/api/admin/distributions', adminController.handleCreateDistribution);
  router.post('/api/admin/broadcast', adminController.handleBroadcast);
  router.get('/api/admin/audit-logs', adminController.handleGetAuditLogs);

  // 4. Payment & Checkout APIs
  router.get('/api/checkout/:transactionId', paymentController.handleGetCheckoutInfo);
  router.post('/api/payments/test-complete', paymentController.handleTestPaymentComplete);

  // 5. Public APIs
  router.get('/api/public/transparency', publicController.handleGetPublicTransparency);
  router.get('/api/public/receipt/:transactionId', publicController.handleGetPublicReceipt);

  // 6. Webhooks
  router.post('/webhook/telegram/:botId', webhookController.handleTelegramWebhook);
  router.post('/webhook/payment/:provider', webhookController.handlePaymentWebhook);

  // 7. Static UI Handlers
  router.get('/checkout/:transactionId', (req, res) => {
    serveFile(res, path.resolve(__dirname, 'static/checkout/index.html'), 'text/html');
  });

  router.get('/public/transparency.html', (req, res) => {
    serveFile(res, path.resolve(__dirname, 'static/public/transparency.html'), 'text/html');
  });

  router.get('/admin', (req, res) => {
    serveFile(res, path.resolve(__dirname, 'static/admin/index.html'), 'text/html');
  });

  router.get('/', (req, res) => {
    // Redirect root to public transparency portal or admin
    res.writeHead(302, { Location: '/public/transparency.html' });
    res.end();
  });

  const server = http.createServer(async (req, res) => {
    // Basic IP Rate limiting
    const clientIp = req.socket.remoteAddress || '127.0.0.1';
    if (!httpRateLimiter.isAllowed(clientIp)) {
      return sendJson(res, 429, { error: 'Too Many Requests. Rate limit exceeded.' });
    }

    try {
      const matched = await router.match(req, res);
      if (!matched) {
        // Fallback for static admin files
        if (req.url.startsWith('/admin')) {
          return serveFile(res, path.resolve(__dirname, 'static/admin/index.html'), 'text/html');
        }
        sendJson(res, 404, { error: 'Route not found' });
      }
    } catch (err) {
      console.error('[Server Error]:', err);
      sendJson(res, 500, { error: 'Internal Server Error' });
    }
  });

  return server;
}

function serveFile(res, filePath, contentType) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('File Not Found');
    return;
  }

  const content = fs.readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'no-cache',
  });
  res.end(content);
}

module.exports = {
  createHttpServer,
};
