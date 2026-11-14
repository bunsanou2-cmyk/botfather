-- ==============================================================================
-- 🇰🇭 KHMER HELP KHMER - CORE DATABASE SCHEMA
-- Native SQLite 3 with Foreign Keys, WAL mode, Strict Constraints and Indexes
-- ==============================================================================

PRAGMA foreign_keys = ON;

-- 1. Bot & Donor Users
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  language TEXT DEFAULT 'km', -- 'km' for Khmer, 'en' for English
  total_donated REAL DEFAULT 0.0,
  donation_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 2. Beneficiaries
CREATE TABLE IF NOT EXISTS beneficiaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL, -- 'sick', 'student', 'elderly', 'team'
  full_name TEXT NOT NULL,
  full_name_km TEXT,
  age INTEGER,
  gender TEXT,
  location TEXT NOT NULL,
  location_km TEXT,
  profile_image_url TEXT,
  current_situation TEXT NOT NULL,
  current_situation_km TEXT NOT NULL,
  short_description TEXT,
  short_description_km TEXT,
  story TEXT NOT NULL,
  story_km TEXT NOT NULL,
  amount_needed REAL NOT NULL,
  amount_received REAL DEFAULT 0.0,
  status TEXT DEFAULT 'DRAFT', -- DRAFT, PENDING_REVIEW, VERIFIED, REJECTED, SUSPENDED, COMPLETED
  verification_badge INTEGER DEFAULT 0, -- 1 = verified
  verification_notes TEXT,
  supporting_documents TEXT, -- JSON array of private documents (Admin only)
  contact_info TEXT, -- Private contact info (Admin only)
  is_team_fund INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 3. Campaigns (Links to Beneficiaries)
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  beneficiary_id INTEGER NOT NULL REFERENCES beneficiaries(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  title_km TEXT NOT NULL,
  target_amount REAL NOT NULL,
  current_amount REAL DEFAULT 0.0,
  status TEXT DEFAULT 'ACTIVE', -- ACTIVE, TARGET_REACHED, COMPLETED, CANCELLED
  start_date TEXT NOT NULL,
  end_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 4. Donations
CREATE TABLE IF NOT EXISTS donations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  donation_code TEXT UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id),
  telegram_id TEXT NOT NULL,
  beneficiary_id INTEGER NOT NULL REFERENCES beneficiaries(id),
  campaign_id INTEGER REFERENCES campaigns(id),
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'PENDING', -- PENDING, PAID, FAILED, CANCELLED, REFUNDED
  payment_provider TEXT NOT NULL,
  transaction_id TEXT UNIQUE NOT NULL,
  payment_url TEXT,
  donor_note TEXT,
  is_anonymous INTEGER DEFAULT 0,
  paid_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 5. Payment Transactions (Idempotency and Provider Auditing)
CREATE TABLE IF NOT EXISTS payment_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  donation_id INTEGER NOT NULL REFERENCES donations(id),
  transaction_id TEXT UNIQUE NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL,
  provider TEXT NOT NULL,
  provider_tx_id TEXT,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL, -- PENDING, PAID, FAILED, CANCELLED, REFUNDED
  raw_payload TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 6. Assistance / Distribution Records (Separate from Donations)
CREATE TABLE IF NOT EXISTS distributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER REFERENCES campaigns(id),
  beneficiary_id INTEGER NOT NULL REFERENCES beneficiaries(id),
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  distributed_date TEXT NOT NULL,
  method TEXT NOT NULL, -- 'Cash in Hand', 'Bank Transfer', 'Direct Hospital Payment', 'Supplies'
  reference_number TEXT,
  admin_id INTEGER REFERENCES admin_users(id),
  admin_name TEXT,
  proof_document TEXT, -- Photo URL or document proof of handover
  notes TEXT,
  status TEXT DEFAULT 'DISTRIBUTED', -- PENDING, PROCESSING, DISTRIBUTED
  created_at TEXT NOT NULL
);

-- 7. Admin Users
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT DEFAULT 'SUPER_ADMIN', -- SUPER_ADMIN, VERIFIER, FINANCE_ADMIN
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
);

-- 8. Beneficiary Verification Records
CREATE TABLE IF NOT EXISTS verification_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  beneficiary_id INTEGER NOT NULL REFERENCES beneficiaries(id),
  admin_id INTEGER REFERENCES admin_users(id),
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);

-- 9. Audit Logs (Immutable Financial and Administrative Trail)
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_type TEXT NOT NULL, -- 'ADMIN', 'SYSTEM', 'DONOR'
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL
);

-- 10. Broadcast Announcements
CREATE TABLE IF NOT EXISTS broadcast_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER REFERENCES admin_users(id),
  message_text TEXT NOT NULL,
  media_type TEXT,
  media_url TEXT,
  total_targets INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'COMPLETED',
  created_at TEXT NOT NULL
);

-- Performance and Integrity Indexes
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_donations_telegram_id ON donations(telegram_id);
CREATE INDEX IF NOT EXISTS idx_donations_transaction_id ON donations(transaction_id);
CREATE INDEX IF NOT EXISTS idx_donations_beneficiary_id ON donations(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_status ON beneficiaries(status);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_category ON beneficiaries(category);
CREATE INDEX IF NOT EXISTS idx_payment_tx_id ON payment_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_idempotency ON payment_transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_distributions_beneficiary ON distributions(beneficiary_id);
