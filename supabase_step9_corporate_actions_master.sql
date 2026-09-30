-- Step 9 Migration: Corporate Actions Master Table
-- Stores announced market corporate actions (demergers, splits, bonuses, mergers, buybacks)
-- for automated portfolio notification and 1-click execution.

CREATE TABLE IF NOT EXISTS corporate_actions_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  isin TEXT NOT NULL,
  symbol TEXT NOT NULL,
  company_name TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('split', 'bonus', 'demerger', 'merger', 'buyback')),
  ratio_num NUMERIC NOT NULL,
  ratio_denom NUMERIC NOT NULL,
  cost_factor NUMERIC DEFAULT 100, -- e.g. 9.12 for Jio Fin demerger (cost allocation %)
  record_date DATE NOT NULL,
  ex_date DATE NOT NULL,
  target_isin TEXT,
  target_symbol TEXT,
  target_company_name TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_corporate_actions_master_isin ON corporate_actions_master(isin);
CREATE INDEX IF NOT EXISTS idx_corporate_actions_master_symbol ON corporate_actions_master(symbol);
CREATE INDEX IF NOT EXISTS idx_corporate_actions_master_record_date ON corporate_actions_master(record_date);

ALTER TABLE corporate_actions_master ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read access to authenticated" ON corporate_actions_master;
CREATE POLICY "Allow read access to authenticated" ON corporate_actions_master FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow full access to authenticated" ON corporate_actions_master;
CREATE POLICY "Allow full access to authenticated" ON corporate_actions_master FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed notable historical and recent Indian corporate actions
INSERT INTO corporate_actions_master (
  isin, symbol, company_name, action_type, ratio_num, ratio_denom, cost_factor, record_date, ex_date, target_isin, target_symbol, target_company_name, description
) VALUES 
(
  'INE002A01018', 'RELIANCE', 'Reliance Industries Ltd', 'demerger', 1, 1, 9.12, '2023-07-20', '2023-07-20',
  'INE758E01017', 'JIOFIN', 'Jio Financial Services Ltd',
  'Demerger of Financial Services undertaking into Jio Financial Services (Ratio 1:1, 9.12% Cost Allocation)'
),
(
  'INE081A01020', 'TATASTEEL', 'Tata Steel Ltd', 'split', 10, 1, 100, '2022-07-29', '2022-07-28',
  'INE081A01020', 'TATASTEEL', 'Tata Steel Ltd',
  'Subdivision of equity shares from face value of Rs 10 to Rs 1 (Ratio 10:1)'
),
(
  'INE075A01022', 'WIPRO', 'Wipro Ltd', 'bonus', 1, 1, 0, '2024-12-03', '2024-12-03',
  'INE075A01022', 'WIPRO', 'Wipro Ltd',
  'Bonus issue of equity shares in the ratio of 1:1'
),
(
  'INE467B01029', 'TCS', 'Tata Consultancy Services Ltd', 'buyback', 1, 1, 100, '2023-11-25', '2023-11-24',
  'INE467B01029', 'TCS', 'Tata Consultancy Services Ltd',
  'TCS Buyback at Rs 4,150 per equity share via tender offer'
),
(
  'INE214T01019', 'LTIM', 'LTIMindtree Ltd', 'merger', 73, 100, 100, '2022-11-24', '2022-11-23',
  'INE214T01019', 'LTIM', 'LTIMindtree Ltd',
  'Merger of Mindtree Ltd with L&T Infotech (73 LTIM shares for every 100 Mindtree shares)'
)
ON CONFLICT DO NOTHING;
