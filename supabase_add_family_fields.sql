
-- Add missing columns to families table for full parity with db.json and Master Entry UI
ALTER TABLE families ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE families ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE families ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE families ADD COLUMN IF NOT EXISTS country TEXT;

-- Verify the columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'families';
