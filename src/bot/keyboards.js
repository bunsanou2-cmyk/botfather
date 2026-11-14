/**
 * Telegram Bot Inline Keyboards
 */

const { t } = require('./i18n');

function getHomeKeyboard(lang = 'km') {
  return {
    inline_keyboard: [
      [
        { text: t(lang, 'btnHelpSick'), callback_data: 'cat_sick' },
        { text: t(lang, 'btnHelpStudents'), callback_data: 'cat_student' },
      ],
      [
        { text: t(lang, 'btnHelpElderly'), callback_data: 'cat_elderly' },
        { text: t(lang, 'btnTeamFund'), callback_data: 'team_fund' },
      ],
      [
        { text: t(lang, 'btnMyDonations'), callback_data: 'nav_my_donations' },
        { text: t(lang, 'btnHistory'), callback_data: 'nav_history' },
      ],
      [
        { text: t(lang, 'btnTransparency'), callback_data: 'nav_transparency' },
        { text: t(lang, 'btnLanguage'), callback_data: 'nav_language' },
      ],
      [
        { text: t(lang, 'btnAboutUs'), callback_data: 'nav_about' },
        { text: t(lang, 'btnContactAdmin'), callback_data: 'nav_contact' },
      ],
    ],
  };
}

function getBeneficiaryCardKeyboard(beneficiaryId, category, lang = 'km') {
  return {
    inline_keyboard: [
      [
        { text: t(lang, 'btnDonate'), callback_data: `donate_${beneficiaryId}` },
        { text: t(lang, 'btnViewDetails'), callback_data: `view_${beneficiaryId}` },
      ],
      [
        { text: t(lang, 'btnBackHome'), callback_data: 'nav_home' },
      ],
    ],
  };
}

function getBeneficiaryDetailKeyboard(beneficiaryId, category, lang = 'km') {
  return {
    inline_keyboard: [
      [
        { text: t(lang, 'btnDonateNow'), callback_data: `donate_${beneficiaryId}` },
      ],
      [
        { text: t(lang, 'btnBack'), callback_data: `cat_${category}` },
        { text: t(lang, 'btnBackHome'), callback_data: 'nav_home' },
      ],
    ],
  };
}

function getAmountSelectionKeyboard(beneficiaryId, lang = 'km') {
  return {
    inline_keyboard: [
      [
        { text: '$0.10', callback_data: `amt_${beneficiaryId}_0.10` },
        { text: '$1.00', callback_data: `amt_${beneficiaryId}_1.00` },
        { text: '$5.00', callback_data: `amt_${beneficiaryId}_5.00` },
      ],
      [
        { text: '$10.00', callback_data: `amt_${beneficiaryId}_10.00` },
        { text: '$25.00', callback_data: `amt_${beneficiaryId}_25.00` },
        { text: '$50.00', callback_data: `amt_${beneficiaryId}_50.00` },
      ],
      [
        { text: '$100.00', callback_data: `amt_${beneficiaryId}_100.00` },
        { text: t(lang, 'btnCustomAmount'), callback_data: `custom_${beneficiaryId}` },
      ],
      [
        { text: t(lang, 'btnCancel'), callback_data: `view_${beneficiaryId}` },
      ],
    ],
  };
}

function getConfirmationKeyboard(paymentUrl, transactionId, beneficiaryId, lang = 'km') {
  return {
    inline_keyboard: [
      [
        { text: t(lang, 'btnPayNow'), url: paymentUrl },
      ],
      [
        { text: '🔄 Check Status', callback_data: `checktx_${transactionId}` },
        { text: t(lang, 'btnCancel'), callback_data: `view_${beneficiaryId}` },
      ],
    ],
  };
}

function getLanguageKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🇰🇭 ភាសាខ្មែរ (Khmer)', callback_data: 'setlang_km' },
        { text: '🇬🇧 English', callback_data: 'setlang_en' },
      ],
      [
        { text: '🏠 Home Menu', callback_data: 'nav_home' },
      ],
    ],
  };
}

module.exports = {
  getHomeKeyboard,
  getBeneficiaryCardKeyboard,
  getBeneficiaryDetailKeyboard,
  getAmountSelectionKeyboard,
  getConfirmationKeyboard,
  getLanguageKeyboard,
};
