import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function inspectSchema() {
  console.log("Checking Supabase tables status and schemas...\n");
  const tables = ['asset_master', 'ledgers', 'prices', 'pms_portfolios', 'pms_transactions', 'pms_tax_lots', 'families', 'groups', 'accounts', 'capital_gains_summary'];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table '${table}': ERROR (${error.message})`);
    } else {
      const cols = data && data.length > 0 ? Object.keys(data[0]) : [];
      console.log(`Table '${table}': EXISTS. Rows: ${data ? data.length : 0}. Columns: ${cols.join(', ')}`);
    }
  }
}

inspectSchema().catch(console.error);
