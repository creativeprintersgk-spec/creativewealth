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
  // transc1: what are maid=132 records? Check if they map to acmac1
  console.log('=== transc1 maid=132 (the most common small maid) ===');
  const { data: c1Maid132 } = await s.from('transc1').select('transid,vid,maid,dramt,cramt,acid,dt').eq('maid', 132).limit(5);
  console.log(JSON.stringify(c1Maid132, null, 2));
  
  // Check acmac1 for id=132
  const { data: acmac132 } = await s.from('acmac1').select('*').eq('id', 132);
  console.log('\nacmac1 id=132:', JSON.stringify(acmac132, null, 2));

  // Check vouchersc1 for these vouchers — what is their type?
  const { data: vouchers } = await s.from('vouchersc1').select('vid,vtyp,narr,acid,dt').in('vid', [1,2,3,4,5]);
  console.log('\nvouchersc1 vids 1-5:', JSON.stringify(vouchers, null, 2));

  // trans1: maid=11 appears as both debit and credit side
  // Is maid=11 the "Cash/Bank" ledger in acmac1?
  const { data: acmac11 } = await s.from('acmac1').select('id,name,acid,is_group').eq('id', 11);
  console.log('\nacmac1 id=11:', JSON.stringify(acmac11, null, 2));
  
  // trans1: maid=401 
  const { data: acmac401 } = await s.from('acmac1').select('id,name,acid,is_group').eq('id', 401);
  console.log('\nacmac1 id=401:', JSON.stringify(acmac401, null, 2));

  // What are the 7 unique maid values in transc1?
  const { data: c1All } = await s.from('transc1').select('maid');
  const uniqueMailds = [...new Set(c1All?.map((r: any) => r.maid))].sort((a, b) => a - b);
  console.log('\nAll unique transc1 maids:', uniqueMailds);
  
  // Check each in acmac1
  for (const maid of uniqueMailds) {
    const { data: match } = await s.from('acmac1').select('id,name,acid').eq('id', maid).limit(2);
    console.log(`  maid=${maid} → acmac1: ${JSON.stringify(match)}`);
  }
}
run();
