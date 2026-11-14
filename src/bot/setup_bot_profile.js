/**
 * Telegram Bot Profile Setup Script
 * Sets the bot's name, description, short description, and commands via Bot API.
 */

const config = require('../config');

async function setup() {
  const token = config.telegram.token;
  if (!token) {
    console.error('Error: TELEGRAM_BOT_TOKEN is not set in .env');
    return;
  }

  const post = async (method, body) => {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await res.json();
  };

  console.log('1. Setting bot name...');
  const nameRes = await post('setMyName', { name: '🇰🇭 Khmer Help Khmer' });
  console.log('   Result:', nameRes);

  console.log('2. Setting bot description...');
  const descRes = await post('setMyDescription', {
    description: `🇰🇭 KHMER HELP KHMER (ខ្មែរជួយខ្មែរ)

«រួមគ្នា យើងអាចជួយគ្រួសារខ្មែរមួយម្តងៗ»
"Together, we can help one Khmer family at a time."

A verified Cambodian humanitarian donation platform connecting caring donors with vetted people in urgent need:
❤️ Sick People
🎓 Students
👵 Elderly People
🤝 Team Field Operations

Browse verified stories and donate starting from $0.10.`,
  });
  console.log('   Result:', descRes);

  console.log('3. Setting short description...');
  const shortRes = await post('setMyShortDescription', {
    short_description: '🇰🇭 Transparent Cambodian donation bot connecting donors with verified people in need. Donate from $0.10.',
  });
  console.log('   Result:', shortRes);

  console.log('4. Setting menu commands...');
  const cmdRes = await post('setMyCommands', {
    commands: [
      { command: 'start', description: '🇰🇭 Open Main Menu / បើកម៉ឺនុយដើម' },
      { command: 'help', description: 'ℹ️ About Us & Principles / អំពីយើង' },
      { command: 'transparency', description: '🏛️ Public Transparency / តម្លាភាព' },
      { command: 'contact', description: '☎️ Contact Admin / ទាក់ទងអ្នកគ្រប់គ្រង' },
    ],
  });
  console.log('   Result:', cmdRes);

  console.log('Bot profile setup completed successfully!');
}

setup().catch(console.error);
