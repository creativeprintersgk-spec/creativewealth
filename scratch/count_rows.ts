import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function check() {
  for (const table of ['accounts', 'portfolios', 'ledgers', 'vouchers', 'entries']) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    if (error) {
      console.error(`Error counting ${table}:`, error);
    } else {
      console.log(`Table ${table} has ${count} rows`);
    }
  }
}

check().catch(console.error);
