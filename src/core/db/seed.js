/**
 * Seed & Demo Data Script for Khmer Help Khmer
 * Populates realistic Cambodian humanitarian cases, campaigns, default admin,
 * sample donations, and verified aid distribution records.
 */

const { initDb, queryOne, execute, transaction } = require('./database');
const { hashPassword, ensureDefaultAdmin } = require('../security/auth');
const config = require('../../config');

function seedDatabase() {
  initDb();
  ensureDefaultAdmin();

  const count = queryOne('SELECT COUNT(*) as count FROM beneficiaries');
  if (count && count.count > 0) {
    console.log('[Seed] Database already contains beneficiaries. Skipping duplicate seeding.');
    return;
  }

  const now = new Date().toISOString();

  transaction(() => {
    // 1. Team Fund Beneficiary
    execute(
      `INSERT INTO beneficiaries (
        category, full_name, full_name_km, age, gender, location, location_km,
        profile_image_url, current_situation, current_situation_km,
        short_description, short_description_km, story, story_km,
        amount_needed, amount_received, status, verification_badge,
        verification_notes, is_team_fund, created_at, updated_at
      ) VALUES (
        'team',
        'Khmer Help Khmer Operating & Field Fund',
        'មូលនិធិទ្រទ្រង់ប្រតិបត្តិការ ខ្មែរជួយខ្មែរ',
        NULL, 'Team', 'Phnom Penh & All Provinces', 'រាជធានីភ្នំពេញ និងគ្រប់បណ្តាខេត្ត',
        'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
        'Humanitarian field verification and emergency relief logistics across Cambodia.',
        'ដំណើរការចុះមូលដ្ឋានផ្ទាល់ ផ្ទៀងផ្ទាត់ករណីជនរងគ្រោះ និងដឹកជញ្ជូនជំនួយទូទាំងប្រទេសកម្ពុជា។',
        'Supports vehicle fuel, medical record checks, and emergency response across Cambodia.',
        'ទ្រទ្រង់ថ្លៃសាំងចុះខេត្ត ការពិនិត្យឯកសារពេទ្យ និងការឆ្លើយតបបន្ទាន់។',
        'Khmer Help Khmer relies on operational donations to sustain our volunteer field agents, transport relief supplies to isolated communes, verify medical records at provincial hospitals, and ensure 100% audited delivery of donor funds.',
        'វេទិកា ខ្មែរជួយខ្មែរ ត្រូវការការគាំទ្រពីសប្បុរសជនដើម្បីទ្រទ្រង់ថ្លៃធ្វើដំណើររបស់ក្រុមការងារស្ម័គ្រចិត្ត ចុះទៅដល់ខ្នងផ្ទះជនរងគ្រោះតាមបណ្តាខេត្តដាច់ស្រយាល ផ្ទៀងផ្ទាត់ឯកសារពេទ្យនៅមន្ទីរពេទ្យបង្អែក និងធានាការប្រគល់ថវិកាដល់ដៃជនរងគ្រោះដោយផ្ទាល់ ១០០%។',
        5000.00, 1250.00, 'VERIFIED', 1,
        'Official operational campaign approved by management committee.',
        1, ?, ?
      )`,
      [now, now]
    );

    // 2. Beneficiary 1: Lok Yeay Sokha (Sick)
    execute(
      `INSERT INTO beneficiaries (
        category, full_name, full_name_km, age, gender, location, location_km,
        profile_image_url, current_situation, current_situation_km,
        short_description, short_description_km, story, story_km,
        amount_needed, amount_received, status, verification_badge,
        verification_notes, is_team_fund, created_at, updated_at
      ) VALUES (
        'sick',
        'Lok Yeay Sokha',
        'លោកយាយ សុខា',
        72, 'Female', 'Battambang Province', 'ខេត្តបាត់ដំបង',
        'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80',
        'Suffering from acute diabetic complications and kidney failure requiring hemodialysis.',
        'កំពុងសម្រាកព្យាបាលជំងឺទឹកនោមផ្អែមធ្ងន់ធ្ងរ និងខ្សោយតម្រងនោមត្រូវការលាងឈាមជាបន្ទាន់។',
        'Urgent dialysis and cardiovascular medication support.',
        'ត្រូវការថវិកាលាងឈាម និងថ្នាំបេះដូងបន្ទាន់។',
        'Lok Yeay Sokha is 72 years old living in Moung Ruessei District, Battambang. Her family has exhausted all their meager rice-farming savings on initial hospital treatments. She requires bi-weekly hemodialysis treatments and insulin therapy to survive.',
        'លោកយាយ សុខា អាយុ ៧២ ឆ្នាំ រស់នៅស្រុកមោងឫស្សី ខេត្តបាត់ដំបង។ គ្រួសារលោកយាយបានលក់អស់ទ្រព្យសម្បត្តិ និងស្រូវអង្ករដើម្បីព្យាបាលជំងឺ។ បច្ចុប្បន្នលោកយាយត្រូវការលាងឈាម ២ ដងក្នុងមួយសប្តាហ៍ និងថ្នាំអាំងស៊ុយលីនជាប្រចាំដើម្បីបន្តរស់នៅ។',
        1500.00, 620.00, 'VERIFIED', 1,
        'Hospital records from Battambang Provincial Hospital verified on-site by field team.',
        0, ?, ?
      )`,
      [now, now]
    );

    // 3. Beneficiary 2: Little Chamroeun (Sick child)
    execute(
      `INSERT INTO beneficiaries (
        category, full_name, full_name_km, age, gender, location, location_km,
        profile_image_url, current_situation, current_situation_km,
        short_description, short_description_km, story, story_km,
        amount_needed, amount_received, status, verification_badge,
        verification_notes, is_team_fund, created_at, updated_at
      ) VALUES (
        'sick',
        'Little Chamroeun',
        'កុមារា ចំរើន',
        8, 'Male', 'Kampong Cham Province', 'ខេត្តកំពង់ចាម',
        'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
        'Diagnosed with congenital ventricular septal defect requiring pediatric cardiac surgery.',
        'កើតជំងឺពិការបេះដូងពីកំណើត (ប្រហោងបេះដូង) ត្រូវការវះកាត់បន្ទាន់។',
        'Pediatric heart surgery and post-operative recovery.',
        'ថវិកាវះកាត់បេះដូង និងស្តារនីតិសម្បទាក្រោយវះកាត់។',
        'Eight-year-old Chamroeun lives with his widowed mother in Kampong Cham. Due to congenital heart condition, he suffers from shortness of breath and cannot attend school regularly. Doctors scheduled pediatric surgery at Kantha Bopha hospital, but pre-surgical and post-operative medications exceed the family capacity.',
        'កុមារា ចំរើន អាយុ ៨ ឆ្នាំ រស់នៅជាមួយម្តាយមេម៉ាយក្រីក្រនៅខេត្តកំពង់ចាម។ ដោយសារជំងឺប្រហោងបេះដូងពីកំណើត ធ្វើឱ្យប្អូនពិបាកដកដង្ហើម និងមិនអាចទៅរៀនបានទៀងទាត់។ ក្រុមវេជ្ជបណ្ឌិតបានកំណត់កាលបរិច្ឆេទវះកាត់ ប៉ុន្តែការចំណាយលើការថែទាំ និងថ្នាំបំប៉នបន្ទាប់ពីវះកាត់ ហួសពីលទ្ធភាពម្តាយ។',
        2800.00, 1400.00, 'VERIFIED', 1,
        'Pediatric medical diagnosis book and commune poverty certificate verified.',
        0, ?, ?
      )`,
      [now, now]
    );

    // 4. Beneficiary 3: Sreypov (Student)
    execute(
      `INSERT INTO beneficiaries (
        category, full_name, full_name_km, age, gender, location, location_km,
        profile_image_url, current_situation, current_situation_km,
        short_description, short_description_km, story, story_km,
        amount_needed, amount_received, status, verification_badge,
        verification_notes, is_team_fund, created_at, updated_at
      ) VALUES (
        'student',
        'Sreypov Keo',
        'កញ្ញា កែវ ស្រីពៅ',
        19, 'Female', 'Siem Reap Province', 'ខេត្តសៀមរាប',
        'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80',
        'Grade A graduate from rural high school, accepted into Computer Science degree.',
        'ប្រឡងបាក់ឌុបជាប់និទ្ទេស A មកពីតំបន់ជនបទ បានជាប់អាហារូបករណ៍រៀនព័ត៌មានវិទ្យា។',
        'University dorm, laptop, and food support for rural female scholar.',
        'ជំនួយស្នាក់នៅ កុំព្យូទ័រ និងអាហារូបករណ៍ប្រចាំខែ។',
        'Sreypov achieved top academic marks despite studying under kerosene lamp in rural Kralanh, Siem Reap. She earned admission to university in Phnom Penh but has zero family financial backing for living costs, dormitory rent, and basic study laptop.',
        'ស្រីពៅ រៀនពូកែជាប់និទ្ទេស A ទោះបីជាត្រូវឆ្លងកាត់ការលំបាកខ្វះខាតក្នុងស្រុកក្រឡាញ់ ខេត្តសៀមរាប។ នាងទទួលបានការអនុញ្ញាតចូលរៀនផ្នែកព័ត៌មានវិទ្យានៅភ្នំពេញ ប៉ុន្តែឪពុកម្តាយជាកសិករគ្មានលទ្ធភាពទំនុកបម្រុងថ្លៃស្នាក់នៅ អាហារ និងកុំព្យូទ័រសម្រាប់សិក្សាឡើយ។',
        800.00, 480.00, 'VERIFIED', 1,
        'High school diploma, academic transcripts, and rural poverty certification inspected.',
        0, ?, ?
      )`,
      [now, now]
    );

    // 5. Beneficiary 4: Ta Mok (Elderly)
    execute(
      `INSERT INTO beneficiaries (
        category, full_name, full_name_km, age, gender, location, location_km,
        profile_image_url, current_situation, current_situation_km,
        short_description, short_description_km, story, story_km,
        amount_needed, amount_received, status, verification_badge,
        verification_notes, is_team_fund, created_at, updated_at
      ) VALUES (
        'elderly',
        'Lok Ta Mok',
        'លោកតា ម៉ុក',
        78, 'Male', 'Pursat Province', 'ខេត្តពោធិ៍សាត់',
        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80',
        'Living alone in a damaged thatched hut without relatives or income.',
        'រស់នៅតែម្នាក់ឯងក្នុងខ្ទមបាក់បែក គ្មានកូនចៅ និងគ្មានប្រភពចំណូល។',
        'Roof repair, monthly rice ration, and warm clothing.',
        'ជួសជុលដំបូលខ្ទម អង្ករហូបប្រចាំខែ និងសម្លៀកបំពាក់កក់ក្តៅ។',
        'Lok Ta Mok survived the civil war era and is now 78 years old with no living descendants. His wooden hut roof leaks heavily during the monsoon season. He relies on generous neighbors for daily rice.',
        'លោកតា ម៉ុក អាយុ ៧៨ ឆ្នាំ រស់នៅស្រុកភ្នំក្រវាញ ខេត្តពោធិ៍សាត់។ លោកតាគ្មានកូនចៅ ឬសាច់ញាតិនៅរស់ឡើយ។ ខ្ទមស្លឹកដែលលោកតាស្នាក់នៅត្រូវទឹកភ្លៀងលិចរាល់រដូវវស្សា។ លោកតាត្រូវការពង្រឹងជញ្ជាំង ដំបូល និងអង្ករហូបប្រចាំខែ។',
        500.00, 320.00, 'VERIFIED', 1,
        'Commune chief confirmation and on-site shelter photo verification completed.',
        0, ?, ?
      )`,
      [now, now]
    );

    // 6. Beneficiary 5: Yeay Samrith (Elderly - Target Reached Example)
    execute(
      `INSERT INTO beneficiaries (
        category, full_name, full_name_km, age, gender, location, location_km,
        profile_image_url, current_situation, current_situation_km,
        short_description, short_description_km, story, story_km,
        amount_needed, amount_received, status, verification_badge,
        verification_notes, is_team_fund, created_at, updated_at
      ) VALUES (
        'elderly',
        'Yeay Samrith',
        'លោកយាយ សំរិទ្ធ',
        82, 'Female', 'Takeo Province', 'ខេត្តតាកែវ',
        'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80',
        'Blind elderly grandmother without living relatives.',
        'លោកយាយចាស់ជរាពិការភ្នែកទាំងសងខាង គ្មានសាច់ញាតិទីពឹង។',
        'Caregiver stipend and solar lighting installed.',
        'ឧបត្ថម្ភអ្នកថែទាំ និងដំឡើងភ្លើងសូឡា។',
        'Yeay Samrith is 82 years old and completely blind in Bati District, Takeo. Thanks to generous Khmer Help Khmer donors, her initial campaign reached its 100% target and assistance has been delivered!',
        'លោកយាយ សំរិទ្ធ អាយុ ៨២ ឆ្នាំ ពិការភ្នែកទាំងសងខាង នៅស្រុកបាទី ខេត្តតាកែវ។ ដោយសារសប្បុរសធម៌របស់បងប្អូនខ្មែរ យុទ្ធនាការរបស់លោកយាយបានសម្រេច ១០០% ហើយជំនួយត្រូវបានប្រគល់ជូនរួចរាល់!',
        400.00, 400.00, 'VERIFIED', 1,
        'Fully audited and distributed to local community caregiver.',
        0, ?, ?
      )`,
      [now, now]
    );

    // Link Campaigns to each Beneficiary
    const allBeneficiaries = execute('SELECT id, full_name, full_name_km, amount_needed, amount_received FROM beneficiaries');
    // We can query them
  });

  // Re-query to create campaigns
  const beneficiaries = queryOne('SELECT id FROM beneficiaries LIMIT 1');
  if (beneficiaries) {
    const list = queryOne ? [
      { id: 1, title: 'Support Khmer Help Khmer Operations', title_km: 'ទ្រទ្រង់ប្រតិបត្តិការ ខ្មែរជួយខ្មែរ', target: 5000, current: 1250, status: 'ACTIVE' },
      { id: 2, title: 'Emergency Medical Care for Lok Yeay Sokha', title_km: 'សង្គ្រោះបន្ទាន់លោកយាយ សុខា', target: 1500, current: 620, status: 'ACTIVE' },
      { id: 3, title: 'Heart Surgery for Little Chamroeun', title_km: 'វះកាត់បេះដូងកុមារា ចំរើន', target: 2800, current: 1400, status: 'ACTIVE' },
      { id: 4, title: 'University Dormitory & Laptop Fund for Sreypov', title_km: 'អាហារូបករណ៍ស្នាក់នៅ និងកុំព្យូទ័រស្រីពៅ', target: 800, current: 480, status: 'ACTIVE' },
      { id: 5, title: 'Shelter Repair & Food for Lok Ta Mok', title_km: 'ជួសជុលជម្រក និងស្បៀងលោកតា ម៉ុក', target: 500, current: 320, status: 'ACTIVE' },
      { id: 6, title: 'Caregiver Support for Yeay Samrith', title_km: 'ឧបត្ថម្ភអ្នកថែទាំលោកយាយ សំរិទ្ធ', target: 400, current: 400, status: 'TARGET_REACHED' },
    ] : [];

    for (const c of list) {
      execute(
        `INSERT INTO campaigns (beneficiary_id, title, title_km, target_amount, current_amount, status, start_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, c.title, c.title_km, c.target, c.current, c.status, now, now, now]
      );
    }
  }

  // Sample verified distribution record
  execute(
    `INSERT INTO distributions (
      campaign_id, beneficiary_id, amount, currency, distributed_date,
      method, reference_number, admin_name, notes, status, created_at
    ) VALUES (
      6, 6, 400.00, 'USD', '2026-11-10',
      'Cash in Hand & Solar Installation', 'DIST-2026-001', 'Sopheap Chan',
      'Handed over $400 directly to commune appointed caregiver for Yeay Samrith with signed receipt.',
      'DISTRIBUTED', ?
    )`,
    [now]
  );

  console.log('[Seed] Database populated successfully with realistic Cambodian cases!');
}

if (require.main === module) {
  seedDatabase();
}

module.exports = {
  seedDatabase,
};
