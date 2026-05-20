-- STEP 1: Create Families/Groups/Accounts
-- Create families table
CREATE TABLE IF NOT EXISTS public.families (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create groups table (asset categories)
CREATE TABLE IF NOT EXISTS public.groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,  -- 'asset' or 'account'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link portfolios to families (add column)
ALTER TABLE pms_portfolios 
ADD COLUMN IF NOT EXISTS family_id TEXT REFERENCES families(id);

-- Insert family
INSERT INTO public.families (id, name) 
VALUES ('pramesh_shah_family', 'Pramesh Shah Family')
ON CONFLICT (id) DO NOTHING;

-- Insert asset groups
INSERT INTO public.groups (id, name, category) VALUES
('stocks', 'Stocks', 'asset'),
('mutual_funds', 'Mutual Funds', 'asset'),
('bonds', 'Bonds', 'asset'),
('gold', 'Gold', 'asset'),
('fd', 'Fixed Deposits', 'asset'),
('nps', 'NPS/ULIP', 'asset'),
('properties', 'Properties', 'asset'),
('cash', 'Bank Accounts', 'account'),
('companies', 'Companies', 'account')
ON CONFLICT (id) DO NOTHING;

-- Link portfolios to family
UPDATE pms_portfolios 
SET family_id = 'pramesh_shah_family'
WHERE family_id IS NULL;

-- STEP 2: Create Chart of Accounts
CREATE TABLE IF NOT EXISTS public.accounts (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  name TEXT NOT NULL,
  account_type TEXT,  -- 'bank', 'broker', 'company', 'person', 'other'
  pan TEXT,
  address TEXT,
  is_group BOOLEAN DEFAULT FALSE,
  parent_id TEXT REFERENCES accounts(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert main accounts from MProfit
INSERT INTO public.accounts (id, family_id, name, account_type, pan) VALUES
('acc_hdfc_1', 'pramesh_shah_family', 'HDFC Bank (A/c. No. 00801000031785)', 'bank', ''),
('acc_kotak_1', 'pramesh_shah_family', 'Kotak Bank (A/c. No. 1912581915)', 'bank', ''),
('acc_sbi_1', 'pramesh_shah_family', 'SBI Bank', 'bank', ''),
('acc_idfc_1', 'pramesh_shah_family', 'IDFC Bank', 'bank', ''),
('acc_person_pramesh', 'pramesh_shah_family', 'Pramesh R Shah', 'person', 'AAIPS3625H'),
('acc_person_saahil', 'pramesh_shah_family', 'Saahil P Shah', 'person', 'CGTPS8217E'),
('acc_person_unnati', 'pramesh_shah_family', 'Unnati P Shah', 'person', 'AAIPS3624G'),
('acc_huf_pramesh', 'pramesh_shah_family', 'Pramesh Shah HUF', 'person', ''),
('acc_company_cp', 'pramesh_shah_family', 'Creative Packaging', 'company', ''),
('acc_company_cprinter', 'pramesh_shah_family', 'Creative Printers', 'company', '')
ON CONFLICT (id) DO NOTHING;

-- STEP 3: Run Capital Gains page setup
-- Create RPC function for capital gains summary
CREATE OR REPLACE FUNCTION get_cg_summary(
  from_date DATE,
  to_date DATE,
  p_portfolio TEXT DEFAULT NULL
) RETURNS TABLE(
  portfolio_id TEXT,
  gain_type TEXT,
  transactions BIGINT,
  total_gain_loss NUMERIC,
  estimated_tax NUMERIC
) AS $$
  SELECT 
    portfolio_id,
    gain_type,
    COUNT(*) as transactions,
    ROUND(SUM(gain_loss)::numeric) as total_gain_loss,
    ROUND(SUM(estimated_tax)::numeric) as estimated_tax
  FROM capital_gains_summary
  WHERE sell_date >= from_date AND sell_date <= to_date
    AND (p_portfolio IS NULL OR portfolio_id = p_portfolio)
  GROUP BY portfolio_id, gain_type
  ORDER BY portfolio_id, gain_type;
$$ LANGUAGE SQL;
