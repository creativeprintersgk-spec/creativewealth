-- ============================================================================
-- STEP 8: Precision upgrade, audit trail, and reporting views
-- Corrected versions of the 4 findings from the Gemini/Jcode review.
-- See the corrected-vs-original rationale in the accompanying prompt doc.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- POINT 2: Upgrade quantity/price precision (as proposed, unchanged)
-- DECIMAL(20,4) truncates fractional units on crypto/high-precision NAVs.
-- DECIMAL(28,8) matches what most portfolio/crypto trackers use.
-- Defensive: only alters columns that actually exist, since bs1/transc1/
-- sum_table aren't in any tracked schema file (see SCHEMA_EXPORT_INSTRUCTIONS.md
-- -- run that BEFORE this, so you have a rollback point).
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bs1' AND column_name='qn') THEN
    ALTER TABLE bs1 ALTER COLUMN qn TYPE DECIMAL(28,8);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bs1' AND column_name='purpr') THEN
    ALTER TABLE bs1 ALTER COLUMN purpr TYPE DECIMAL(28,8);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bs1' AND column_name='netpr') THEN
    ALTER TABLE bs1 ALTER COLUMN netpr TYPE DECIMAL(28,8);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bs1' AND column_name='amt') THEN
    ALTER TABLE bs1 ALTER COLUMN amt TYPE DECIMAL(28,8);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sum_table' AND column_name='qnt') THEN
    ALTER TABLE sum_table ALTER COLUMN qnt TYPE DECIMAL(28,8);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sum_table' AND column_name='currv') THEN
    ALTER TABLE sum_table ALTER COLUMN currv TYPE DECIMAL(28,8);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sum_table' AND column_name='amtinv') THEN
    ALTER TABLE sum_table ALTER COLUMN amtinv TYPE DECIMAL(28,8);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transc1' AND column_name='dramt') THEN
    ALTER TABLE transc1 ALTER COLUMN dramt TYPE DECIMAL(28,8);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transc1' AND column_name='cramt') THEN
    ALTER TABLE transc1 ALTER COLUMN cramt TYPE DECIMAL(28,8);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- POINT 2: tax_lot_consumption audit table (as proposed, unchanged)
-- Persists what buildAssetFifoLedger()/depleteFifoLots() currently only
-- compute in-memory: which specific lot(s) a real sale consumed, at what
-- cost, and how much of each. Written by createVoucher() at the moment a
-- sale voucher is booked (see the logic.ts change in the accompanying diff)
-- -- this table does NOT drive any calculation itself (buildAssetFifoLedger
-- keeps recomputing fresh from bs1 every time, as it does today); it exists
-- purely as a queryable audit trail for "why did this sale cost what it did."
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_lot_consumption (
  id BIGSERIAL PRIMARY KEY,
  vid INTEGER NOT NULL,
  pfid INTEGER NOT NULL,
  amid INTEGER NOT NULL,
  sell_date DATE NOT NULL,
  lot_date DATE NOT NULL,
  qty_consumed DECIMAL(28,8) NOT NULL,
  cost_per_unit DECIMAL(28,8) NOT NULL,
  cost_consumed DECIMAL(28,8) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tax_lot_consumption_pfid_amid ON tax_lot_consumption(pfid, amid);
CREATE INDEX IF NOT EXISTS idx_tax_lot_consumption_vid ON tax_lot_consumption(vid);

ALTER TABLE tax_lot_consumption ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated full access" ON tax_lot_consumption;
CREATE POLICY "Authenticated full access" ON tax_lot_consumption FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- POINT 3 (CORRECTED): corporate_actions as a pure event LOG, no trigger.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS corporate_actions (
  id BIGSERIAL PRIMARY KEY,
  pfid INTEGER NOT NULL,
  amid INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  action_date DATE NOT NULL,
  ratio_or_pct DECIMAL(28,8),
  related_amid INTEGER,
  vid INTEGER,
  narration TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_corporate_actions_pfid_amid ON corporate_actions(pfid, amid);

ALTER TABLE corporate_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated full access" ON corporate_actions;
CREATE POLICY "Authenticated full access" ON corporate_actions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- POINT 4 (CORRECTED): v_cash_flows as a RAW projection only -- no terminal
-- value, no XIRR math in SQL.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_cash_flows AS
SELECT
  trid,
  pfid,
  amid,
  dt AS flow_date,
  CASE
    WHEN trty IN (12, 15, 19, 20, 25, 30) THEN 'buy'
    WHEN trty IN (99, 101, 150) THEN 'sell'
    WHEN trty = 62 THEN 'dividend'
    ELSE NULL
  END AS flow_type,
  CASE
    WHEN trty IN (12, 15, 19, 20, 25, 30) THEN -amt
    WHEN trty IN (99, 101, 150, 62) THEN amt
    ELSE NULL
  END AS cash_amount
FROM bs1
WHERE trty IN (12, 15, 19, 20, 25, 30, 99, 101, 150, 62)
  AND amt IS NOT NULL AND amt <> 0;
