-- STEP 1: Insert Family (Only id and name)
INSERT INTO public.families (id, name) 
VALUES ('pramesh_shah_family', 'Pramesh Shah Family')
ON CONFLICT (id) DO NOTHING;

-- STEP 2: Insert Groups (Using type instead of category, as per your schema)
INSERT INTO public."groups" (id, name, type) VALUES
('stocks', 'Stocks', 'asset'),
('mutual_funds', 'Mutual Funds', 'asset'),
('bonds', 'Bonds', 'asset'),
('gold', 'Gold', 'asset'),
('fd', 'Fixed Deposits', 'asset'),
('nps', 'NPS/ULIP', 'asset'),
('properties', 'Properties', 'asset'),
('cash', 'Bank Accounts', 'account'),
('companies', 'Companies', 'account')
ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type;

-- STEP 3: Link PMS Portfolios to Family
UPDATE public.pms_portfolios 
SET family_id = 'pramesh_shah_family'
WHERE family_id IS NULL;

-- STEP 4: Insert Accounts (Using account_name instead of name)
INSERT INTO public.accounts (id, family_id, account_name, pan) VALUES
('acc_hdfc_1', 'pramesh_shah_family', 'HDFC Bank (A/c. No. 00801000031785)', ''),
('acc_kotak_1', 'pramesh_shah_family', 'Kotak Bank (A/c. No. 1912581915)', ''),
('acc_sbi_1', 'pramesh_shah_family', 'SBI Bank', ''),
('acc_idfc_1', 'pramesh_shah_family', 'IDFC Bank', ''),
('acc_person_pramesh', 'pramesh_shah_family', 'Pramesh R Shah', 'AAIPS3625H'),
('acc_person_saahil', 'pramesh_shah_family', 'Saahil P Shah', 'CGTPS8217E'),
('acc_person_unnati', 'pramesh_shah_family', 'Unnati P Shah', 'AAIPS3624G'),
('acc_huf_pramesh', 'pramesh_shah_family', 'Pramesh Shah HUF', ''),
('acc_company_cp', 'pramesh_shah_family', 'Creative Packaging', ''),
('acc_company_cprinter', 'pramesh_shah_family', 'Creative Printers', '')
ON CONFLICT (id) DO NOTHING;

-- STEP 5: Create CG RPC
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
