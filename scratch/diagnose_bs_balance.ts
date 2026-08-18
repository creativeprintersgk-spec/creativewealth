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
  // Check: does transc1 maid=502791 match an acmac1 ledger for acid=61?
  const { data: ledger } = await s.from('acmac1').select('id,name,acid,cr_bal,db_bal,parent_id').eq('id', 502791).eq('acid', 61);
  console.log('acmac1 id=502791 acid=61:', JSON.stringify(ledger, null, 2));

  // How many transc1 large-maid entries are there vs matching acmac1?
  const { data: c1Large } = await s.from('transc1').select('maid').gt('maid', 100000);
  const largeMaids = [...new Set(c1Large?.map((r: any) => r.maid) || [])];
  console.log(`\ntransc1 distinct large maids: ${largeMaids.length}`);

  // Check a few
  for (const maid of largeMaids.slice(0, 5)) {
    const { data: match } = await s.from('acmac1').select('id,name,acid').eq('id', maid).eq('acid', 61);
    console.log(`maid=${maid} → acmac1 acid=61: ${match?.length ? match[0].name : 'NOT FOUND'}`);
  }

  // What about the balance sheet totals from trans1 only (accounting entries)?
  // Sum all dramt and cramt from trans1 to check if they balance
  const { data: t1Totals } = await s.from('trans1').select('dramt,cramt');
  let totalDr = 0, totalCr = 0;
  t1Totals?.forEach((r: any) => { totalDr += Number(r.dramt) || 0; totalCr += Number(r.cramt) || 0; });
  console.log(`\ntrans1 totals: DR=${totalDr.toFixed(2)}, CR=${totalCr.toFixed(2)}, diff=${(totalDr - totalCr).toFixed(2)}`);

  // Same for transc1
  const { data: c1Totals } = await s.from('transc1').select('dramt,cramt');
  let c1Dr = 0, c1Cr = 0;
  c1Totals?.forEach((r: any) => { c1Dr += Number(r.dramt) || 0; c1Cr += Number(r.cramt) || 0; });
  console.log(`transc1 totals: DR=${c1Dr.toFixed(2)}, CR=${c1Cr.toFixed(2)}, diff=${(c1Dr - c1Cr).toFixed(2)}`);
}
run();
