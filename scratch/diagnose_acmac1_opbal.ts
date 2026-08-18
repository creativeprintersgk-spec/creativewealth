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

async function run() {
  // 1. What columns does acmac1 have?
  const { data: sample } = await s.from('acmac1').select('*').limit(3);
  console.log('=== acmac1 sample rows (all columns) ===');
  console.log(JSON.stringify(sample, null, 2));

  // 2. Check how many rows have non-zero opbal / cr_bal / db_bal
  const { data: withOpbal } = await s.from('acmac1').select('id, name, acid, opbal, cr_bal, db_bal, is_group').not('opbal', 'is', null).limit(10);
  console.log('\n=== acmac1 rows with non-null opbal ===');
  console.log(JSON.stringify(withOpbal, null, 2));

  // 3. Stats on non-group (ledger) rows
  const { count: ledgerCount } = await s.from('acmac1').select('*', { count: 'exact', head: true }).eq('is_group', false);
  const { count: groupCount } = await s.from('acmac1').select('*', { count: 'exact', head: true }).eq('is_group', true);
  console.log(`\n=== Counts: ledgers=${ledgerCount}, groups=${groupCount} ===`);
}
run();
