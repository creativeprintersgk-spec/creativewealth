import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  // Query table list using a simple query or rpc or check what tables we can read from
  const tables = [
    'portfolios', 'investor_group_members', 'acc_pflink', 'acmac1', 'sam',
    'asset_master', 'bs1', 'sum_table', 'vouchersc1', 'vouchers1',
    'transc1', 'trans1', 'mprices', 'prices'
  ];
  
  for (const t of tables) {
    const { data, error } = await sb.from(t).select('*').limit(1);
    if (error) {
      console.log(`Table ${t}: Error - ${error.message}`);
    } else {
      console.log(`Table ${t}: Exists! Column names:`, Object.keys(data[0] || {}));
    }
  }
}
main().catch(console.error);
