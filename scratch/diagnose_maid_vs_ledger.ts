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
  // What maid values are in transc1? Are they ledger IDs or asset IDs?
  const { data: c1Sample } = await s.from('transc1').select('transid,vid,maid,dramt,cramt,acid,dt').not('maid', 'is', null).limit(10);
  console.log('=== transc1 sample (maid col) ===');
  console.log(JSON.stringify(c1Sample, null, 2));

  // What maid values are in trans1?
  const { data: t1Sample } = await s.from('trans1').select('transid,vid,maid,dramt,cramt,acid,dt').not('maid', 'is', null).limit(10);
  console.log('\n=== trans1 sample (maid col) ===');
  console.log(JSON.stringify(t1Sample, null, 2));

  // Do any maid values from transc1 match acmac1 ledger IDs?
  const { data: ledgerIds } = await s.from('acmac1').select('id').eq('is_group', false).limit(20);
  const ids = ledgerIds?.map((r: any) => r.id) || [];
  console.log('\n=== Sample acmac1 ledger IDs ===', ids.slice(0, 20));

  // Check if transc1 maids overlap with acmac1 ids
  const { data: matchC1 } = await s.from('transc1').select('transid,maid').in('maid', ids.slice(0, 10));
  console.log('\ntransc1 rows where maid matches an acmac1 ledger id:', matchC1?.length || 0, 'rows');
  
  // Check distinct maid ranges
  const { data: c1Maids } = await s.from('transc1').select('maid').limit(2000);
  const maidNums = [...new Set(c1Maids?.map((r: any) => r.maid) || [])].sort((a, b) => a - b);
  console.log('\ntransc1 distinct maid range: min=', maidNums[0], 'max=', maidNums[maidNums.length-1], 'count=', maidNums.length);
  
  const { data: t1Maids } = await s.from('trans1').select('maid').limit(2000);
  const t1MaidNums = [...new Set(t1Maids?.map((r: any) => r.maid) || [])].sort((a, b) => a - b);
  console.log('trans1 distinct maid range: min=', t1MaidNums[0], 'max=', t1MaidNums[t1MaidNums.length-1], 'count=', t1MaidNums.length);
}
run();
