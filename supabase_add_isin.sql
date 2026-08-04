-- WealthCore PMS: Add ISIN to asset_master
-- Run this script in your Supabase SQL Editor

ALTER TABLE asset_master ADD COLUMN IF NOT EXISTS isin TEXT;

-- Create an index to speed up ISIN resolution during imports
CREATE INDEX IF NOT EXISTS idx_asset_master_isin ON asset_master(isin);

-- Map NTPC's ISIN to its master record as a starting point
UPDATE asset_master SET isin = 'INE733E01010' WHERE amid = 104519;
