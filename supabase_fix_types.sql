-- FIX: Change IDs from UUID to TEXT for compatibility with existing db.json data
-- Run this in the Supabase SQL Editor

ALTER TABLE entries DROP CONSTRAINT IF EXISTS entries_ledger_id_fkey;
ALTER TABLE entries DROP CONSTRAINT IF EXISTS entries_voucher_id_fkey;
ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_portfolio_id_fkey;
ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_account_id_fkey;
ALTER TABLE portfolios DROP CONSTRAINT IF EXISTS portfolios_account_id_fkey;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_family_id_fkey;
ALTER TABLE prices DROP CONSTRAINT IF EXISTS prices_ledger_id_fkey;

ALTER TABLE families ALTER COLUMN id TYPE TEXT;
ALTER TABLE accounts ALTER COLUMN id TYPE TEXT, ALTER COLUMN family_id TYPE TEXT;
ALTER TABLE portfolios ALTER COLUMN id TYPE TEXT, ALTER COLUMN account_id TYPE TEXT;
ALTER TABLE ledgers ALTER COLUMN id TYPE TEXT;
ALTER TABLE vouchers ALTER COLUMN id TYPE TEXT, ALTER COLUMN account_id TYPE TEXT, ALTER COLUMN portfolio_id TYPE TEXT;
ALTER TABLE entries ALTER COLUMN id TYPE TEXT, ALTER COLUMN voucher_id TYPE TEXT, ALTER COLUMN ledger_id TYPE TEXT;
ALTER TABLE prices ALTER COLUMN ledger_id TYPE TEXT;

-- Restore Constraints
ALTER TABLE accounts ADD CONSTRAINT accounts_family_id_fkey FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE;
ALTER TABLE portfolios ADD CONSTRAINT portfolios_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE vouchers ADD CONSTRAINT vouchers_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id);
ALTER TABLE vouchers ADD CONSTRAINT vouchers_portfolio_id_fkey FOREIGN KEY (portfolio_id) REFERENCES portfolios(id);
ALTER TABLE entries ADD CONSTRAINT entries_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE;
ALTER TABLE entries ADD CONSTRAINT entries_ledger_id_fkey FOREIGN KEY (ledger_id) REFERENCES ledgers(id);
ALTER TABLE prices ADD CONSTRAINT prices_ledger_id_fkey FOREIGN KEY (ledger_id) REFERENCES ledgers(id) ON DELETE CASCADE;
