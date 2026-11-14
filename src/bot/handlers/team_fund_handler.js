/**
 * Team Fund Handler
 * Allows donors to support the operating and field verification costs of Khmer Help Khmer.
 */

const { queryOne } = require('../../core/db/database');
const { getUserLanguage, t } = require('../i18n');

async function handleTeamFund(telegramClient, query) {
  const chatId = query.message.chat.id;
  const lang = getUserLanguage(chatId);

  // Find or use team fund beneficiary
  const teamBeneficiary = queryOne('SELECT * FROM beneficiaries WHERE is_team_fund = 1 LIMIT 1');
  const teamId = teamBeneficiary ? teamBeneficiary.id : 1;

  await telegramClient.answerCallbackQuery(query.id);

  const textKm = `
🤝 <b>បរិច្ចាគគាំទ្រដល់ក្រុមការងារ ខ្មែរជួយខ្មែរ</b>
━━━━━━━━━━━━━━━━━━━━━━
ការបរិច្ចាគរបស់អ្នកនៅក្នុងផ្នែកនេះ គឺដើម្បីទ្រទ្រង់ដល់ដំណើរការការងារមនុស្សធម៌ប្រចាំថ្ងៃរបស់យើង រួមមាន:

🚗 <b>ការធ្វើដំណើរ & ចុះមូលដ្ឋាន:</b> ចុះទៅដល់ខ្នងផ្ទះជនរងគ្រោះតាមបណ្តាខេត្តដាច់ស្រយាល
🔍 <b>ការផ្ទៀងផ្ទាត់ផ្ទាល់:</b> ពិនិត្យឯកសារវេជ្ជសាស្ត្រ និងស្ថានភាពរស់នៅជាក់ស្តែង
🎥 <b>ផលិតមាតិកា & ផ្សព្វផ្សាយ:</b> ថតរូប និងវីដេអូរឿងរ៉ាវពិតដើម្បីស្វែងរកជំនួយ
📦 <b>ការដឹកជញ្ជូន & ចែកអំណោយ:</b> ប្រគល់ថវិកា និងគ្រឿងឧបភោគដល់ដៃជនរងគ្រោះ
⚙️ <b>ការគ្រប់គ្រងប្រព័ន្ធ & តម្លាភាព:</b> ថែរក្សាប្រព័ន្ធបច្ចេកវិទ្យា និងរបាយការណ៍សវនកម្ម

រាល់ការចូលរួម $0.10, $1 ឬ $10 របស់អ្នក ជួយឱ្យយើងអាចបន្តបេសកកម្មជួយខ្មែរបានកាន់តែទូលំទូលាយ!
━━━━━━━━━━━━━━━━━━━━━━
`.trim();

  const textEn = `
🤝 <b>Donate to Khmer Help Khmer Operations</b>
━━━━━━━━━━━━━━━━━━━━━━
Your contributions here support our dedicated field operations and logistics:

🚗 <b>Field Transportation:</b> Travel to remote rural provinces to reach vulnerable families
🔍 <b>On-Site Verification:</b> Inspecting medical records and home conditions in person
🎥 <b>Content & Storytelling:</b> Producing authentic photos & video stories to raise awareness
📦 <b>Delivery of Aid:</b> Directly handing over emergency funds, medicines, and food rations
⚙️ <b>Tech & Administrative Operations:</b> Maintaining servers, audit databases, and public transparency

Every donation starting from $0.10 keeps our humanitarian rescue work active and reliable!
━━━━━━━━━━━━━━━━━━━━━━
`.trim();

  const text = lang === 'km' ? textKm : textEn;
  const btnText = lang === 'km' ? '❤️ បរិច្ចាគដល់ក្រុមការងារ' : '❤️ DONATE TO OUR TEAM';

  const keyboard = {
    inline_keyboard: [
      [{ text: btnText, callback_data: `donate_${teamId}` }],
      [{ text: t(lang, 'btnBackHome'), callback_data: 'nav_home' }],
    ],
  };

  await telegramClient.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

module.exports = {
  handleTeamFund,
};
