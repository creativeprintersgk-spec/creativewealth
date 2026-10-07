I have completed the audit of the WealthCore Supabase schema. While the foundation is solid for basic accounting, it lacks the rigor required for a production-grade Portfolio Management System (PMS) regarding tax-loss harvesting, corporate action adjustments, and XIRR precision.

### 1. Schema Integrity & Data Flow Audit

**Risk:** The current `entries` table puts `quantity` and `price` at the journal level. In double-entry, a "Buy" voucher has two entries: Debit Asset and Credit Cash. If quantity is recorded on both, it doubles the position; if on one, it's hard to query without logic knowing which side is the "Asset" side.
**Risk:** Lack of `transaction_category` makes XIRR calculation impossible as you cannot distinguish between a "Dividend" (Income) and a "Capital Addition" (External Inflow).

**Fixes:**
```sql
-- Add transaction categories to distinguish cash flows
ALTER TABLE vouchers ADD COLUMN flow_type TEXT 
CHECK (flow_type IN ('INFLOW', 'OUTFLOW', 'INTERNAL', 'INCOME', 'EXPENSE'));

-- Add constraint to prevent negative quantities in tax lots
ALTER TABLE tax_lots ADD CONSTRAINT non_negative_qty CHECK (remaining_quantity >= 0);

-- Link tax_lots to entries instead of vouchers for granular tracking
ALTER TABLE tax_lots DROP CONSTRAINT tax_lots_voucher_id_fkey;
ALTER TABLE tax_lots ADD COLUMN entry_id UUID REFERENCES entries(id) ON DELETE CASCADE;
```

### 2. FIFO Tax Lot Allocation & Rounding

**Risk:** Using `DECIMAL(20, 4)` for quantity is insufficient for modern PMS (e.g., Crypto or fractional US stocks) and leads to "Dust" (tiny remaining balances) that prevent lot closure.
**Risk:** No `realized_gain` tracking at the lot level, making capital gains reporting slow and error-prone.

**Fixes:**
```sql
-- Increase precision to 8 decimals for quantities
ALTER TABLE tax_lots ALTER COLUMN quantity TYPE DECIMAL(28, 8);
ALTER TABLE tax_lots ALTER COLUMN remaining_quantity TYPE DECIMAL(28, 8);
ALTER TABLE entries ALTER COLUMN quantity TYPE DECIMAL(28, 8);

-- Create a table to track lot consumption (The "Audit Trail" of a Sell)
CREATE TABLE tax_lot_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sell_entry_id UUID REFERENCES entries(id),
  buy_lot_id TEXT REFERENCES tax_lots(id),
  quantity_consumed DECIMAL(28, 8) NOT NULL,
  realized_gain DECIMAL(20, 2),
  holding_period_days INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3. Corporate Actions (Splits/Bonuses/Mergers)

**Risk:** The current schema handles only Buy/Sell. A stock split (e.g., 1:10) requires updating all *existing* tax lots for that asset without creating new vouchers, or the cost-basis will be 10x higher than reality.

**Fixes:**
```sql
-- Corporate Actions Log
CREATE TABLE corporate_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id UUID REFERENCES ledgers(id),
  type TEXT CHECK (type IN ('SPLIT', 'BONUS', 'MERGER', 'SPINOFF')),
  ex_date DATE NOT NULL,
  ratio_numerator DECIMAL NOT NULL,
  ratio_denominator DECIMAL NOT NULL,
  processed BOOLEAN DEFAULT false
);

-- Function to adjust tax lots on Split/Bonus
CREATE OR REPLACE FUNCTION process_corporate_action() 
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'SPLIT' THEN
    UPDATE tax_lots 
    SET 
      remaining_quantity = remaining_quantity * (NEW.ratio_numerator / NEW.ratio_denominator),
      quantity = quantity * (NEW.ratio_numerator / NEW.ratio_denominator),
      cost_per_unit = cost_per_unit * (NEW.ratio_denominator / NEW.ratio_numerator)
    WHERE ledger_id = NEW.ledger_id AND is_closed = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 4. XIRR & Performance Reporting Prerequisites

**Risk:** XIRR requires a specific array of `(date, amount)`. Currently, finding the "Market Value" on a specific historical date requires a heavy join across `entries`, `vouchers`, and `prices`.

**Fixes:**
*   **Daily Snapshots:** For performant XIRR, create a materialized view or table that stores `daily_portfolio_valuation`.
*   **External Cash Flow Flag:** Ensure `vouchers` are tagged accurately. XIRR should only consider `flow_type IN ('INFLOW', 'OUTFLOW')` and the final `fair_market_value`.

```sql
-- Optimized view for XIRR input
CREATE VIEW v_cash_flows AS
SELECT 
  portfolio_id,
  date,
  CASE 
    WHEN flow_type = 'INFLOW' THEN (debit - credit)
    WHEN flow_type = 'OUTFLOW' THEN (debit - credit)
    ELSE 0 
  END as amount
FROM vouchers v
JOIN entries e ON v.id = e.voucher_id
WHERE flow_type IN ('INFLOW', 'OUTFLOW');
```

### Final Recommendations
1.  **Atomicity:** Use a PostgreSQL Transaction (or Supabase Function) for Sells to ensure `tax_lot_consumption` and `entries` are updated simultaneously.
2.  **Validation:** Add a trigger to ensure `Debit == Credit` for every `voucher_id` before commit.
3.  **Indexing:** Add a composite index on `prices(ledger_id, date DESC)` to speed up Valuation/XIRR lookups.

| Task | Priority | Status |
| :--- | :--- | :--- |
| Fix Decimal Precision | High | 🟢 Proposed |
| Implement `tax_lot_consumption` | Critical | 🟢 Proposed |
| Corporate Action Trigger | Medium | 🟢 Proposed |
| XIRR Cash Flow View | High | 🟢 Proposed |
[Tokens] upload: 2382 download: 1392

