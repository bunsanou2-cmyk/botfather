/**
 * 🇰🇭 KHMER HELP KHMER - Master Application Entrypoint
 * Bootstraps database, runs migrations, seeds initial data,
 * starts native HTTP server and initializes the Telegram Bot service.
 */

const config = require('./config');
const { initDb, closeDb } = require('./core/db/database');
const { ensureDefaultAdmin } = require('./core/security/auth');
const { seedDatabase } = require('./core/db/seed');
const { createHttpServer } = require('./server/http_server');
const botService = require('./bot/bot_service');

async function bootstrap() {
  console.log('============================================================');
  console.log('🇰🇭 KHMER HELP KHMER - PRODUCTION CHARITY PLATFORM');
  console.log('============================================================');

  // 1. Initialize SQLite database & migrations
  console.log(`[Init] Connecting to database: ${config.db.path}`);
  initDb();
  console.log('[Init] Database schema migrations executed successfully.');

  // 2. Ensure default super admin account
  ensureDefaultAdmin();

  // 3. Seed initial Cambodian beneficiaries and campaigns if needed
  seedDatabase();

  // 4. Start HTTP Server
  const server = createHttpServer();
  server.listen(config.port, config.host, () => {
    console.log(`[HTTP Server] Listening on http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`);
    console.log(`[Admin Portal] Access admin dashboard: ${config.appUrl}/admin`);
    console.log(`[Transparency] Public audit portal: ${config.appUrl}/public/transparency.html`);
    console.log(`[Payment Mode] Current mode: ${config.payment.mode.toUpperCase()} (Provider: ${config.payment.provider})`);
  });

  // 5. Start Telegram Bot Service
  await botService.start();

  // Graceful shutdown handling
  function shutdown(signal) {
    console.log(`\n[Shutdown] Received ${signal}. Terminating gracefully...`);
    botService.stop();
    server.close(() => {
      closeDb();
      console.log('[Shutdown] All connections closed. Goodbye.');
      process.exit(0);
    });
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

if (require.main === module) {
  bootstrap().catch(err => {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  });
}

module.exports = {
  bootstrap,
};
