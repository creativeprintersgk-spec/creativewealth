import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const s = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const tables = [
  'portfolios', 'investor_group_members', 'acc_pflink', 'acmac1', 'sam',
  'bs1', 'sum_table', 'vouchersc1', 'vouchers1', 'transc1', 'trans1', 'mprices', 'scnote1'
];

async function check() {
  for (const t of tables) {
    const { count, error } = await s.from(t).select('*', { count: 'exact', head: true });
    console.log(t.padEnd(25), 'Count:', count, error ? error.message : 'OK');
  }
}
check();
