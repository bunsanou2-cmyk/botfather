/**
 * Khmer Help Khmer - Configuration Manager
 * Loads environment variables from .env if present and provides typed configuration.
 */

const fs = require('node:fs');
const path = require('node:path');

// Safe .env loader that does not crash if .env does not exist
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          // Remove wrapping quotes if present
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (process.env[key] === undefined) {
            process.env[key] = val;
          }
        }
      }
    } catch (err) {
      console.warn('[Config] Notice: Error reading .env file:', err.message);
    }
  }
}

loadEnv();

const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT, 10) || 3000,
  host: process.env.HOST || '0.0.0.0',
  appUrl: (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, ''),

  db: {
    path: path.resolve(process.cwd(), process.env.DATABASE_PATH || './data/khmer_help_khmer.db'),
  },

  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || '',
    useWebhook: process.env.TELEGRAM_USE_WEBHOOK === 'true',
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || 'khmer_help_khmer_default_secret_2026',
    adminContactUsername: process.env.ADMIN_CONTACT_USERNAME || '@KhmerHelpKhmerSupport',
    supportPhone: process.env.SUPPORT_PHONE || '+855 12 345 678',
    supportEmail: process.env.SUPPORT_EMAIL || 'support@khmerhelpkhmer.org',
  },

  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'KhmerHelpKhmer2026!',
    sessionSecret: process.env.ADMIN_SESSION_SECRET || 'dev_secret_khmer_help_khmer_session_key_987654321',
  },

  payment: {
    mode: process.env.PAYMENT_MODE || 'test', // 'test' | 'production'
    provider: process.env.PAYMENT_PROVIDER || 'test', // 'test' | 'bakong_khqr' | 'stripe'
    webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || 'payment_dev_secret_xyz',
    minDonationAmount: parseFloat(process.env.MIN_DONATION_AMOUNT) || 0.10,
    bakong: {
      merchantId: process.env.BAKONG_MERCHANT_ID || 'khmer_help_khmer@aba',
      acquiringBank: process.env.BAKONG_ACQUIRING_BANK || 'ABA Bank',
      merchantName: process.env.BAKONG_MERCHANT_NAME || 'Khmer Help Khmer Charity',
      merchantCity: process.env.BAKONG_MERCHANT_CITY || 'Phnom Penh',
      currency: process.env.BAKONG_CURRENCY || 'USD',
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    },
  },

  security: {
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 60,
  },
};

module.exports = config;
