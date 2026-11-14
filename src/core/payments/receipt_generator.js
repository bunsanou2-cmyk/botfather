/**
 * Digital Donation Receipt Generator
 * Formats bilingual (Khmer & English) digital receipts for Telegram donors.
 */

function formatReceiptText({ donation, beneficiary, userLang = 'km' }) {
  const dateStr = donation.paid_at
    ? new Date(donation.paid_at).toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' })
    : new Date().toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });

  const beneficiaryName = userLang === 'km' && beneficiary.full_name_km
    ? beneficiary.full_name_km
    : beneficiary.full_name;

  if (userLang === 'km') {
    return `
━━━━━━━━━━━━━━━━━━━━━━
❤️ <b>សូមអរគុណចំពោះការបរិច្ចាគរបស់អ្នក!</b>
🇰🇭 <b>ខ្មែរជួយខ្មែរ | KHMER HELP KHMER</b>
━━━━━━━━━━━━━━━━━━━━━━
ការគាំទ្ររបស់អ្នកបានជួយដល់ប្រជាជនខ្មែរពិតប្រាកដ។

👤 <b>អ្នកទទួលផល:</b> ${beneficiaryName}
💰 <b>ចំនួនទឹកប្រាក់:</b> <b>$${donation.amount.toFixed(2)} USD</b>
🆔 <b>លេខកូដបរិច្ចាគ:</b> <code>${donation.donation_code}</code>
📑 <b>លេខប្រតិបត្តិការ:</b> <code>${donation.transaction_id}</code>
📅 <b>កាលបរិច្ឆេទ:</b> ${dateStr}
💳 <b>វិធីសាស្ត្រទូទាត់:</b> ${donation.payment_provider.toUpperCase()}
✅ <b>ស្ថានភាព:</b> <b>ជោគជ័យ (PAID)</b>

<i>"រួមគ្នា យើងអាចជួយគ្រួសារខ្មែរមួយម្តងៗ"</i>
━━━━━━━━━━━━━━━━━━━━━━`.trim();
  }

  return `
━━━━━━━━━━━━━━━━━━━━━━
❤️ <b>THANK YOU FOR YOUR DONATION</b>
🇰🇭 <b>KHMER HELP KHMER PLATFORM</b>
━━━━━━━━━━━━━━━━━━━━━━
Your generous support helps real Khmer people in urgent need.

👤 <b>Beneficiary:</b> ${beneficiary.full_name}
💰 <b>Donation Amount:</b> <b>$${donation.amount.toFixed(2)} USD</b>
🆔 <b>Donation Code:</b> <code>${donation.donation_code}</code>
📑 <b>Transaction ID:</b> <code>${donation.transaction_id}</code>
📅 <b>Date & Time:</b> ${dateStr}
💳 <b>Payment Method:</b> ${donation.payment_provider.toUpperCase()}
✅ <b>Status:</b> <b>PAID & VERIFIED</b>

<i>"Together, we can help one Khmer family at a time."</i>
━━━━━━━━━━━━━━━━━━━━━━`.trim();
}

module.exports = {
  formatReceiptText,
};
