import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  let output = '';
  const log = (msg) => {
    output += msg + '\n';
  };

  log('Searching for entries with maid = 101556 or 100008...');
  
  const { data: trans1 } = await supabase.from('trans1').select('*').in('maid', [101556, 100008]);
  const { data: transc1 } = await supabase.from('transc1').select('*').in('maid', [101556, 100008]);
  const { data: bs1 } = await supabase.from('bs1').select('*').in('amid', [101556, 100008]);
  const { data: accounts } = await supabase.from('acmac1').select('*');

  log(`\ntrans1 matches count: ${trans1?.length || 0}`);
  (trans1 || []).forEach(e => {
    const acc = accounts?.find(a => a.id === e.maid);
    log(`[trans1] transid: ${e.transid}, vid: ${e.vid}, maid: ${e.maid} (${acc?.name}), dr: ${e.dramt}, cr: ${e.cramt}, acid: ${e.acid}`);
  });

  log(`\ntransc1 matches count: ${transc1?.length || 0}`);
  (transc1 || []).forEach(e => {
    const acc = accounts?.find(a => a.id === e.maid);
    log(`[transc1] transid: ${e.transid}, vid: ${e.vid}, maid: ${e.maid} (${acc?.name}), dr: ${e.dramt}, cr: ${e.cramt}, acid: ${e.acid}`);
  });

  log(`\nbs1 matches count: ${bs1?.length || 0}`);
  (bs1 || []).forEach(b => {
    log(`[bs1] trid: ${b.trid}, pfid: ${b.pfid}, amid: ${b.amid}, amt: ${b.amt}, qn: ${b.qn}, purpr: ${b.purpr}, acvch: ${b.acvch}, acid: ${b.acid}`);
  });

  const vids = Array.from(new Set([
    ...(trans1 || []).map(e => e.vid),
    ...(transc1 || []).map(e => e.vid),
    ...(bs1 || []).map(b => b.acvch).filter(Boolean).map(Number)
  ]));

  if (vids.length > 0) {
    log('\nFetching parent vouchers...');
    const { data: v1 } = await supabase.from('vouchers1').select('*').in('vid', vids);
    const { data: vc1 } = await supabase.from('vouchersc1').select('*').in('vid', vids);
    
    (v1 || []).forEach(v => {
      log(`[vouchers1] vid: ${v.vid}, dt: ${v.dt}, vchno: ${v.vchno}, narr: ${v.narr}, acid: ${v.acid}, pfid: ${v.pfid}`);
    });
    (vc1 || []).forEach(v => {
      log(`[vouchersc1] vid: ${v.vid}, dt: ${v.dt}, vchno: ${v.vchno}, narr: ${v.narr}, acid: ${v.acid}`);
    });

    // Also fetch all entries for these parent vouchers to see their siblings
    log('\nFetching sibling entries for these parent vouchers...');
    const { data: allTrans1 } = await supabase.from('trans1').select('*').in('vid', vids);
    const { data: allTransc1 } = await supabase.from('transc1').select('*').in('vid', vids);
    
    log('\n--- Sibling Entries in trans1 ---');
    (allTrans1 || []).forEach(e => {
      const acc = accounts?.find(a => a.id === e.maid);
      log(`vid: ${e.vid}, transid: ${e.transid}, maid: ${e.maid} (${acc?.name || 'unknown'}), dr: ${e.dramt}, cr: ${e.cramt}, acid: ${e.acid}`);
    });

    log('\n--- Sibling Entries in transc1 ---');
    (allTransc1 || []).forEach(e => {
      const acc = accounts?.find(a => a.id === e.maid);
      log(`vid: ${e.vid}, transid: ${e.transid}, maid: ${e.maid} (${acc?.name || 'unknown'}), dr: ${e.dramt}, cr: ${e.cramt}, acid: ${e.acid}`);
    });
  }

  fs.writeFileSync(path.resolve(__dirname, 'inspect_2690_output.txt'), output);
  console.log('Results written to inspect_2690_output.txt successfully!');
}

run().catch(console.error);
