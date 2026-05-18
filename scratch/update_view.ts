import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  const sql = `
CREATE OR REPLACE VIEW ledger_current_prices AS
SELECT 
  l.id as ledger_id,
  l.name,
  l.amid,
  am.asset_type,
  am.bse_code,
  am.amfi_code,
  am.nse_symbol,
  p.price as current_price,
  p.date as price_date,
  prev.price as prev_price
FROM ledgers l
JOIN asset_master am ON l.amid = am.amid
LEFT JOIN prices p ON p.ledger_id = l.id
  AND p.date = (SELECT MAX(p2.date) FROM prices p2 WHERE p2.ledger_id = l.id)
LEFT JOIN prices prev ON prev.ledger_id = l.id
  AND prev.date = (SELECT MAX(p3.date) FROM prices p3 
                  WHERE p3.ledger_id = l.id 
                  AND p3.date < p.date)
WHERE l.amid IS NOT NULL;
  `;
  
  // Note: anon key might not have permission to execute arbitrary SQL or create views,
  // but let's try calling an rpc if available, or just log.
  // Usually view creation is done in Supabase dashboard by the user.
  console.log("Please ensure the following SQL is run in Supabase SQL Editor:\n", sql);
}
main();
