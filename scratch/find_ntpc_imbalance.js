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
  const NTPC_AMOUNT = 14075.25;

  console.log('=== FINDING NTPC 14075.25 IMBALANCE FOR SAAHIL ===\n');

  // 1. Check bs1 for the NTPC purchase around 2026-05-27
  const { data: bs1Ntpc } = await supabase
    .from('bs1')
    .select('*')
    .gte('dt', '2026-05-01')
    .lte('dt', '2026-06-30');
  
  const ntpcBs1 = (bs1Ntpc || []).filter(t => Math.abs(Number(t.amt) - NTPC_AMOUNT) < 1);
  console.log('--- bs1 entries near 14075.25 in May-Jun 2026 ---');
  ntpcBs1.forEach(t => {
    console.log(`  trid=${t.trid} pfid=${t.pfid} amid=${t.amid} amt=${t.amt} qn=${t.qn} purpr=${t.purpr} dt=${t.dt} acvch=${t.acvch} trty=${t.trty}`);
  });

  // 2. Look for vouchers created around the NTPC purchase date for Saahil
  const { data: vc1Ntpc } = await supabase
    .from('vouchersc1')
    .select('*')
    .eq('acid', SAAHIL_ACID)
    .gte('dt', '2026-05-25')
    .lte('dt', '2026-06-30');
  
  console.log('\n--- vouchersc1 for Saahil (acid=31) in May-Jun 2026 ---');
  (vc1Ntpc || []).forEach(v => {
    console.log(`  vid=${v.vid} dt=${v.dt} narr="${v.narr || ''}" pfid=${v.pfid}`);
  });

  const { data: v1Ntpc } = await supabase
    .from('vouchers1')
    .select('*')
    .eq('acid', SAAHIL_ACID)
    .gte('dt', '2026-05-25')
    .lte('dt', '2026-06-30');
  
  console.log('\n--- vouchers1 for Saahil (acid=31) in May-Jun 2026 ---');
  (v1Ntpc || []).forEach(v => {
    console.log(`  vid=${v.vid} dt=${v.dt} narr="${v.narr || ''}" pfid=${v.pfid}`);
  });

  // 3. Check transc1 for entries containing 14075.25
  const { data: tc1 } = await supabase.from('transc1').select('*').eq('acid', SAAHIL_ACID);
  const ntpcTc1 = (tc1 || []).filter(e => 
    Math.abs(Number(e.dramt) - NTPC_AMOUNT) < 1 || Math.abs(Number(e.cramt) - NTPC_AMOUNT) < 1
  );
  console.log('\n--- transc1 entries for Saahil with 14075.25 ---');
  ntpcTc1.forEach(e => {
    console.log(`  transid=${e.transid} vid=${e.vid} maid=${e.maid} dramt=${e.dramt} cramt=${e.cramt} dt=${e.dt}`);
  });

  // 4. Check trans1 for entries containing 14075.25
  const { data: t1 } = await supabase.from('trans1').select('*').eq('acid', SAAHIL_ACID);
  const ntpcT1 = (t1 || []).filter(e => 
    Math.abs(Number(e.dramt) - NTPC_AMOUNT) < 1 || Math.abs(Number(e.cramt) - NTPC_AMOUNT) < 1
  );
  console.log('\n--- trans1 entries for Saahil with 14075.25 ---');
  ntpcT1.forEach(e => {
    console.log(`  transid=${e.transid} vid=${e.vid} maid=${e.maid} dramt=${e.dramt} cramt=${e.cramt} dt=${e.dt}`);
  });

  // 5. Check NTPC ledger in acmac1 for Saahil
  const { data: ntpcLedgers } = await supabase
    .from('acmac1')
    .select('*')
    .ilike('name', '%NTPC%')
    .eq('acid', SAAHIL_ACID);
  console.log('\n--- acmac1 NTPC entries for Saahil (acid=31) ---');
  ntpcLedgers?.forEach(l => {
    console.log(`  id=${l.id} name="${l.name}" parent_id=${l.parent_id} db_bal=${l.db_bal} cr_bal=${l.cr_bal}`);
  });

  // 6. Check if any transc1/trans1 entry for this ledger ID exists
  if (ntpcLedgers && ntpcLedgers.length > 0) {
    for (const ledger of ntpcLedgers) {
      const { data: tc1Entries } = await supabase.from('transc1').select('*').eq('maid', ledger.id);
      const { data: t1Entries } = await supabase.from('trans1').select('*').eq('maid', ledger.id);
      console.log(`\n  Entries for ledger id=${ledger.id} (${ledger.name}):`);
      console.log(`    transc1: ${tc1Entries?.length || 0} entries`);
      tc1Entries?.forEach(e => console.log(`      transid=${e.transid} vid=${e.vid} dramt=${e.dramt} cramt=${e.cramt} dt=${e.dt}`));
      console.log(`    trans1: ${t1Entries?.length || 0} entries`);
      t1Entries?.forEach(e => console.log(`      transid=${e.transid} vid=${e.vid} dramt=${e.dramt} cramt=${e.cramt} dt=${e.dt}`));
    }
  }

  // 7. Check all vouchers for Saahil - look for any with vid matching acvch in bs1
  if (ntpcBs1.length > 0) {
    console.log('\n--- Looking up vouchers linked to NTPC bs1 entries (via acvch) ---');
    for (const tx of ntpcBs1) {
      if (tx.acvch) {
        const { data: tc1v } = await supabase.from('transc1').select('*').eq('vid', tx.acvch);
        const { data: t1v } = await supabase.from('trans1').select('*').eq('vid', tx.acvch);
        console.log(`  bs1 trid=${tx.trid} -> acvch vid=${tx.acvch}:`);
        console.log(`    transc1 entries: ${tc1v?.length || 0}`);
        tc1v?.forEach(e => console.log(`      transid=${e.transid} maid=${e.maid} dramt=${e.dramt} cramt=${e.cramt}`));
        console.log(`    trans1 entries: ${t1v?.length || 0}`);
        t1v?.forEach(e => console.log(`      transid=${e.transid} maid=${e.maid} dramt=${e.dramt} cramt=${e.cramt}`));
      }
    }
  }
}

run().catch(console.error);
