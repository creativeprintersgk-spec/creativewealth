
-- Migration: Add Tax Lots table for FIFO tracking
CREATE TABLE IF NOT EXISTS tax_lots (
  id TEXT PRIMARY KEY,
  voucher_id TEXT REFERENCES vouchers(id) ON DELETE CASCADE,
  portfolio_id TEXT REFERENCES portfolios(id) ON DELETE CASCADE,
  ledger_id TEXT REFERENCES ledgers(id) ON DELETE CASCADE,
  purchase_date DATE NOT NULL,
  quantity DECIMAL(20, 4) NOT NULL,
  remaining_quantity DECIMAL(20, 4) NOT NULL,
  cost_per_unit DECIMAL(20, 4) NOT NULL,
  cost_total DECIMAL(20, 2) NOT NULL,
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup by portfolio and asset
CREATE INDEX IF NOT EXISTS idx_tax_lots_portfolio_ledger ON tax_lots(portfolio_id, ledger_id);
CREATE INDEX IF NOT EXISTS idx_tax_lots_is_closed ON tax_lots(is_closed);

-- Enable RLS
ALTER TABLE tax_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON tax_lots FOR ALL USING (true);
