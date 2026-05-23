import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  const tables = [
    'families',
    'accounts',
    'portfolios',
    'groups',
    'ledgers',
    'vouchers',
    'entries',
    'prices',
    'investor_groups',
    'tax_lots',
    'pms_portfolios',
    'pms_transactions',
    'pms_tax_lots',
    'asset_master',
    'capital_gains_summary'
  ];

  console.log("=== Row Counts and Schemas ===");
  for (const table of tables) {
    // Select count using head: true
    const { count, error: countErr } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (countErr) {
      console.log(`Table '${table}': Error getting count (${countErr.message})`);
      continue;
    }

    // Select first row to see structure
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
        console.log(`  Sample row:`, JSON.stringify(firstRow[0], null, 2));
      }
    }
  }
}

run().catch(console.error);
