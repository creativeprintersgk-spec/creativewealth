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
  // Check ledger rows that are NOT groups and have non-zero cr_bal or db_bal
  const { data } = await s.from('acmac1').select('id,name,acid,cr_bal,db_bal,is_group').eq('is_group', false).or('cr_bal.gt.0,db_bal.gt.0').limit(10);
  console.log('Ledgers with non-zero balances:', JSON.stringify(data, null, 2));
  
  // check total ledger count per acid
  const { data: acids } = await s.from('acmac1').select('acid').eq('is_group', false);
  const acidCounts: Record<number, number> = {};
  acids?.forEach((r: any) => { acidCounts[r.acid] = (acidCounts[r.acid] || 0) + 1; });
  console.log('Ledger count per acid:', acidCounts);

  // Check voucher entries for opening balances (vid=0)
  const { data: opEntries, count: opCount } = await s.from('transc1').select('*', { count: 'exact' }).eq('vid', 0).limit(5);
  console.log(`\ntransc1 vid=0 (opening) entries: ${opCount}`);
  console.log(JSON.stringify(opEntries, null, 2));
  
  const { data: opEntries2, count: opCount2 } = await s.from('trans1').select('*', { count: 'exact' }).eq('vid', 0).limit(5);
  console.log(`\ntrans1 vid=0 (opening) entries: ${opCount2}`);
  console.log(JSON.stringify(opEntries2, null, 2));
}
run();
