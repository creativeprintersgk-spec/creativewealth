-- WealthCore PMS: Supabase Schema Migration (Phase 1)
-- Run this in the Supabase SQL Editor

-- 1. FAMILIES
CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. ACCOUNTS (Family Members)
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  account_name TEXT NOT NULL,
  pan TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. PORTFOLIOS
CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  portfolio_name TEXT NOT NULL,
  broker TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. GROUPS (Chart of Accounts Hierarchy)
CREATE TABLE groups (
  id TEXT PRIMARY KEY, -- Using string IDs for standard groups (e.g., 'investments')
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES groups(id),
  type TEXT CHECK (type IN ('ASSET', 'LIABILITY', 'INCOME', 'EXPENSE')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. LEDGERS
CREATE TABLE ledgers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id TEXT REFERENCES groups(id),
  name TEXT NOT NULL,
  opening_balance DECIMAL(20, 2) DEFAULT 0,
  opening_type TEXT CHECK (opening_type IN ('DR', 'CR')) DEFAULT 'DR',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. VOUCHERS
CREATE TABLE vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  type TEXT NOT NULL, -- receipt, payment, journal, contra, dividend
  voucher_no TEXT,
  fy TEXT, -- e.g., '2024-2025'
  narration TEXT,
  account_id UUID REFERENCES accounts(id),
  portfolio_id UUID REFERENCES portfolios(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. ENTRIES (Journal Entries)
CREATE TABLE entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID REFERENCES vouchers(id) ON DELETE CASCADE,
  ledger_id UUID REFERENCES ledgers(id),
  debit DECIMAL(20, 2) DEFAULT 0,
  credit DECIMAL(20, 2) DEFAULT 0,
  quantity DECIMAL(20, 4) DEFAULT 0,
  price DECIMAL(20, 4) DEFAULT 0,
  narration TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. PRICES (Asset Price History)
CREATE TABLE prices (
  ledger_id UUID REFERENCES ledgers(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  price DECIMAL(20, 4) NOT NULL,
  PRIMARY KEY (ledger_id, date)
);

-- INDEXES for Performance
CREATE INDEX idx_entries_voucher ON entries(voucher_id);
CREATE INDEX idx_entries_ledger ON entries(ledger_id);
CREATE INDEX idx_vouchers_account ON vouchers(account_id);
CREATE INDEX idx_vouchers_portfolio ON vouchers(portfolio_id);
CREATE INDEX idx_vouchers_date ON vouchers(date);

-- Enable Row Level Security (RLS) - Basic Setup
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

-- Temporary: Allow all access (Update this in Phase 2 with Auth)
CREATE POLICY "Allow all access" ON families FOR ALL USING (true);
CREATE POLICY "Allow all access" ON accounts FOR ALL USING (true);
CREATE POLICY "Allow all access" ON portfolios FOR ALL USING (true);
CREATE POLICY "Allow all access" ON groups FOR ALL USING (true);
CREATE POLICY "Allow all access" ON ledgers FOR ALL USING (true);
CREATE POLICY "Allow all access" ON vouchers FOR ALL USING (true);
CREATE POLICY "Allow all access" ON entries FOR ALL USING (true);
