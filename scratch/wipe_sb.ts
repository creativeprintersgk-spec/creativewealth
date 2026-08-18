import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const TABLES_TO_WIPE = [
  'vouchers1',
  'vouchersc1',
  'trans1',
  'transc1',
  'bs1',
  'sum_table',
  'mprices',
  'acc_pflink',
  'investor_group_members',
  'portfolios',
  'acmac1',
  'sam'
];

async function run() {
  for (const table of TABLES_TO_WIPE) {
    console.log(`Wiping ${table}...`);
    // dummy condition to delete all
    const { error } = await supabase.from(table).delete().neq('id', -999999);
    if (error) {
      console.log(`Fallback delete for ${table}...`);
      const { data } = await supabase.from(table).select().limit(1);
      if (data && data.length > 0) {
        const pk = Object.keys(data[0])[0];
        await supabase.from(table).delete().neq(pk, -999999);
      }
    }
  }
  console.log("WIPE COMPLETE!");
}

run();
