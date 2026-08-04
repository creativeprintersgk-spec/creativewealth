import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const SAAHIL_ACID = 31;
  console.log('=== Finding all vouchers related to 14075.25 for Saahil (acid=31) ===\n');

  // Search transc1 for entries with dramt or cramt = 14075.25 linked to Saahil
  const { data: tc1_dr } = await supabase.from('transc1').select('*').eq('dramt', 14075.25);
  const { data: tc1_cr } = await supabase.from('transc1').select('*').eq('cramt', 14075.25);
  const { data: t1_dr } = await supabase.from('trans1').select('*').eq('dramt', 14075.25);
  const { data: t1_cr } = await supabase.from('trans1').select('*').eq('cramt', 14075.25);

  const allMatching = [
    ...(tc1_dr || []).map(e => ({ ...e, _src: 'c', _side: 'DR' })),
    ...(tc1_cr || []).map(e => ({ ...e, _src: 'c', _side: 'CR' })),
    ...(t1_dr || []).map(e => ({ ...e, _src: 't', _side: 'DR' })),
    ...(t1_cr || []).map(e => ({ ...e, _src: 't', _side: 'CR' })),
  ];

  console.log(`Found ${allMatching.length} entries matching 14075.25:`);
  allMatching.forEach(e => {
    console.log(`  [${e._src}] transid=${e.transid} vid=${e.vid} maid=${e.maid} acid=${e.acid} dr=${e.dramt} cr=${e.cramt} dt=${e.dt}`);
  });

  // For each unique vid, fetch ALL entries of that voucher and check if balanced
  const vids = [...new Set(allMatching.map(e => `${e._src}_${e.vid}`))];
  console.log(`\nChecking full vouchers for vids: ${vids.join(', ')}`);

  for (const key of vids) {
    const [src, vidStr] = key.split('_');
    const vid = Number(vidStr);
    const table = src === 'c' ? 'transc1' : 'trans1';
    const vchTable = src === 'c' ? 'vouchersc1' : 'vouchers1';

    const { data: allLines } = await supabase.from(table).select('*').eq('vid', vid);
    const { data: vch } = await supabase.from(vchTable).select('*').eq('vid', vid);

    const totalDr = (allLines || []).reduce((s, e) => s + (Number(e.dramt) || 0), 0);
    const totalCr = (allLines || []).reduce((s, e) => s + (Number(e.cramt) || 0), 0);
    const diff = totalDr - totalCr;

    console.log(`\n--- Voucher ${key} ---`);
    if (vch && vch[0]) console.log(`  Voucher: dt=${vch[0].dt} narr="${vch[0].narr}" acid=${vch[0].acid} pfid=${vch[0].pfid}`);
    console.log(`  Total DR=${totalDr.toFixed(2)} CR=${totalCr.toFixed(2)} DIFF=${diff.toFixed(2)} ${Math.abs(diff) > 0.01 ? '❌ UNBALANCED' : '✅ balanced'}`);
    (allLines || []).forEach(e => {
      console.log(`    transid=${e.transid} maid=${e.maid} acid=${e.acid} dr=${e.dramt} cr=${e.cramt}`);
    });
  }

  // Also check for any partial/orphan entries where NTPC wrong asset (amid=135) has entries for Saahil
  console.log('\n=== Checking for wrong NTPC futures entries (amid=135) linked to Saahil ===');
  const { data: wrongNtpc } = await supabase.from('transc1').select('*').eq('maid', 135).eq('acid', SAAHIL_ACID);
  const { data: wrongNtpc2 } = await supabase.from('trans1').select('*').eq('maid', 135).eq('acid', SAAHIL_ACID);
  console.log(`transc1 entries for maid=135 (FUTSTKNTPC29NOV2012), acid=${SAAHIL_ACID}:`, wrongNtpc);
  console.log(`trans1 entries for maid=135 (FUTSTKNTPC29NOV2012), acid=${SAAHIL_ACID}:`, wrongNtpc2);
}

run().catch(console.error);
