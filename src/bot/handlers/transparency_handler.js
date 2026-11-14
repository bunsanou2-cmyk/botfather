/**
 * Transparency & Distribution Handler
 * Shows public transparency metrics to donors.
 */

const { queryOne, queryAll } = require('../../core/db/database');
const { getUserLanguage, t } = require('../i18n');

async function handleTransparency(telegramClient, query) {
  const chatId = query.message.chat.id;
  const lang = getUserLanguage(chatId);

  await telegramClient.answerCallbackQuery(query.id);

  const totalDonations = queryOne("SELECT COALESCE(SUM(amount), 0) as total FROM donations WHERE status = 'PAID'");
  const totalDistributions = queryOne("SELECT COALESCE(SUM(amount), 0) as total FROM distributions WHERE status = 'DISTRIBUTED'");
  const activeCampaigns = queryOne("SELECT COUNT(*) as count FROM campaigns WHERE status = 'ACTIVE'");
  const completedCampaigns = queryOne("SELECT COUNT(*) as count FROM campaigns WHERE status IN ('TARGET_REACHED', 'COMPLETED')");
  const verifiedBeneficiaries = queryOne("SELECT COUNT(*) as count FROM beneficiaries WHERE status = 'VERIFIED'");

  // Recent 3 distributions
  const recentDists = queryAll(
    `SELECT d.*, b.full_name, b.full_name_km
     FROM distributions d
     JOIN beneficiaries b ON d.beneficiary_id = b.id
     WHERE d.status = 'DISTRIBUTED'
     ORDER BY d.id DESC LIMIT 3`
  );

  let distList = '';
  if (recentDists.length > 0) {
    distList = recentDists.map(d => {
      const bName = lang === 'km' && d.full_name_km ? d.full_name_km : d.full_name;
      return `• <b>$${d.amount.toFixed(2)}</b> → ${bName} (${d.method})`;
    }).join('\n');
  } else {
    distList = lang === 'km' ? '• កំពុងរៀបចំការចែកចាយថវិកាលើកដំបូង' : '• First distribution cycle in preparation';
  }

  const textKm = `
🏛️ <b>តម្លាភាព និងការផ្តល់ជំនួយ (Transparency)</b>
━━━━━━━━━━━━━━━━━━━━━━
យើងប្តេជ្ញាធានាតម្លាភាព ១០០% សម្រាប់រាល់ថវិកាដែលបានបរិច្ចាគ:

💰 <b>សរុបថវិកាបានបរិច្ចាគ:</b> <b>$${Number(totalDonations.total).toLocaleString()} USD</b>
📦 <b>សរុបជំនួយបានប្រគល់ជូន:</b> <b>$${Number(totalDistributions.total).toLocaleString()} USD</b>
👥 <b>ជនរងគ្រោះបានផ្ទៀងផ្ទាត់:</b> <b>${verifiedBeneficiaries.count} នាក់</b>
🎯 <b>យុទ្ធនាការកំពុងដំណើរការ:</b> <b>${activeCampaigns.count}</b>
🏆 <b>យុទ្ធនាការសម្រេចគោលដៅ:</b> <b>${completedCampaigns.count}</b>

<b>ការប្រគល់ជំនួយចុងក្រោយ:</b>
${distList}

<i>រាល់ការកត់ត្រាមានភស្តុតាង និងបង្កាន់ដៃសវនកម្មត្រឹមត្រូវ</i>
━━━━━━━━━━━━━━━━━━━━━━
`.trim();

  const textEn = `
🏛️ <b>Khmer Help Khmer Transparency Portal</b>
━━━━━━━━━━━━━━━━━━━━━━
We are strictly committed to 100% financial openness:

💰 <b>Total Received Donations:</b> <b>$${Number(totalDonations.total).toLocaleString()} USD</b>
📦 <b>Total Assistance Distributed:</b> <b>$${Number(totalDistributions.total).toLocaleString()} USD</b>
👥 <b>Verified Beneficiaries:</b> <b>${verifiedBeneficiaries.count}</b>
🎯 <b>Active Campaigns:</b> <b>${activeCampaigns.count}</b>
🏆 <b>Successfully Completed:</b> <b>${completedCampaigns.count}</b>

<b>Recent Verified Aid Deliveries:</b>
${distList}

<i>All transactions are audited with verifiable handover proofs.</i>
━━━━━━━━━━━━━━━━━━━━━━
`.trim();

  const text = lang === 'km' ? textKm : textEn;

  await telegramClient.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[{ text: t(lang, 'btnBackHome'), callback_data: 'nav_home' }]],
    },
  });
}

module.exports = {
  handleTransparency,
};
