import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const tables = [
  'clients',
  'portfolios',
  'investor_group_members',
  'sacm',
  'acma1',
  'acmac1',
  'acc_pflink',
  'sam',
  'bs1',
  'sum_table',
  'vouchers1',
  'vouchersc1',
  'trans1',
  'transc1',
  'mprices'
];

async function run() {
  console.log("=== LIVE MPROFIT SCHEMA INSPECTOR ===");
  for (const table of tables) {
    const { count, error: countErr } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (countErr) {
      console.log(`Table '${table}': ERROR (${countErr.message})`);
      continue;
    }

    const { data: firstRow, error: dataErr } = await supabase
      .from(table)
      .select('*')
      .limit(1);

    if (dataErr) {
      console.log(`Table '${table}': Count = ${count}, Error getting first row (${dataErr.message})`);
    } else {
      const cols = firstRow && firstRow.length > 0 ? Object.keys(firstRow[0]) : [];
      console.log(`Table '${table}': Count = ${count}, Columns = [${cols.join(', ')}]`);
      if (firstRow && firstRow.length > 0) {
        console.log(`  Sample row keys/values:`);
        Object.entries(firstRow[0]).forEach(([k, v]) => {
          console.log(`    ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
        });
      }
    }
    console.log("----------------------------------------");
  }
}

run().catch(console.error);
