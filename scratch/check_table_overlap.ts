import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  const [{ data: transc1 }, { data: trans1 }, { data: vouchersc1 }, { data: vouchers1 }] = await Promise.all([
    supabase.from('transc1').select('*'),
    supabase.from('trans1').select('*'),
    supabase.from('vouchersc1').select('*'),
    supabase.from('vouchers1').select('*'),
  ]);

  const c1Ids = new Set((transc1 || []).map((e: any) => e.transid));
  const t1Ids = new Set((trans1 || []).map((e: any) => e.transid));

  let overlap = 0;
  const dupIds: number[] = [];
  t1Ids.forEach(id => { if (c1Ids.has(id)) { overlap++; dupIds.push(id); } });

  console.log(`\n=== TRANSACTION TABLE OVERLAP ANALYSIS ===`);
  console.log(`  transc1 count: ${c1Ids.size}`);
  console.log(`  trans1  count: ${t1Ids.size}`);
  console.log(`  True duplicate transids: ${overlap}`);
  console.log(`  Unique to transc1 only: ${c1Ids.size - overlap}`);
  console.log(`  Unique to trans1  only: ${t1Ids.size - overlap}`);
  console.log(`  CORRECT TOTAL (no duplication): ${c1Ids.size + t1Ids.size - overlap}`);

  // Show some overlapping IDs to understand what they are
  console.log(`\n  Sample overlapping transids: ${dupIds.slice(0, 10).join(', ')}`);

  // Check vouchers overlap too
  const vc1Ids = new Set((vouchersc1 || []).map((e: any) => e.vid));
  const v1Ids = new Set((vouchers1 || []).map((e: any) => e.vid));
  let vOverlap = 0;
  v1Ids.forEach(id => { if (vc1Ids.has(id)) vOverlap++; });

  console.log(`\n=== VOUCHER TABLE OVERLAP ANALYSIS ===`);
  console.log(`  vouchersc1 count: ${vc1Ids.size}`);
  console.log(`  vouchers1  count: ${v1Ids.size}`);
  console.log(`  True duplicate vids: ${vOverlap}`);
  console.log(`  Unique to vouchersc1 only: ${vc1Ids.size - vOverlap}`);
  console.log(`  Unique to vouchers1  only: ${v1Ids.size - vOverlap}`);
  console.log(`  CORRECT TOTAL (no duplication): ${vc1Ids.size + v1Ids.size - vOverlap}`);

  // Are the overlapping entries identical?
  if (dupIds.length > 0) {
    const sampleDupId = dupIds[0];
    const fromC1 = (transc1 || []).find((e: any) => e.transid === sampleDupId);
    const fromT1 = (trans1 || []).find((e: any) => e.transid === sampleDupId);
    console.log(`\n  Sample dup transid=${sampleDupId}:`);
    console.log(`    In transc1: maid=${fromC1?.maid}, vid=${fromC1?.vid}, dramt=${fromC1?.dramt}, cramt=${fromC1?.cramt}, dt=${fromC1?.dt}`);
    console.log(`    In trans1:  maid=${fromT1?.maid}, vid=${fromT1?.vid}, dramt=${fromT1?.dramt}, cramt=${fromT1?.cramt}, dt=${fromT1?.dt}`);
  }
}

run().catch(console.error);
