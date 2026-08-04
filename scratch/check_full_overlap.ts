import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function fetchAll(table: string, pkCol: string): Promise<any[]> {
  let all: any[] = [];
  let page = 0;
  const size = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(table).select('*').order(pkCol).range(page * size, (page + 1) * size - 1);
    if (error) { console.warn(`Error fetching ${table}:`, error.message); break; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < size) break;
    page++;
  }
  return all;
}

async function run() {
  console.log('Fetching all pages of transc1 and trans1...');
  const [transc1, trans1, vouchersc1, vouchers1] = await Promise.all([
    fetchAll('transc1', 'transid'),
    fetchAll('trans1', 'transid'),
    fetchAll('vouchersc1', 'vid'),
    fetchAll('vouchers1', 'vid'),
  ]);

  console.log(`  transc1 TOTAL rows: ${transc1.length}`);
  console.log(`  trans1  TOTAL rows: ${trans1.length}`);
  console.log(`  vouchersc1 TOTAL rows: ${vouchersc1.length}`);
  console.log(`  vouchers1  TOTAL rows: ${vouchers1.length}`);

  const c1Ids = new Set(transc1.map((e: any) => e.transid));
  const t1Ids = new Set(trans1.map((e: any) => e.transid));
  let overlap = 0;
  const dupIds: number[] = [];
  t1Ids.forEach(id => { if (c1Ids.has(id)) { overlap++; dupIds.push(id); } });

  console.log(`\n=== TRANSACTION OVERLAP (all pages) ===`);
  console.log(`  True duplicate transids: ${overlap}`);
  console.log(`  Unique to transc1 only: ${c1Ids.size - overlap}`);
  console.log(`  Unique to trans1  only: ${t1Ids.size - overlap}`);
  console.log(`  CORRECT TOTAL: ${c1Ids.size + t1Ids.size - overlap}`);

  // Verify a sample duplicate - are they truly the same entry?
  if (dupIds.length > 0) {
    console.log(`\n  Verifying sample duplicates (same data?)`);
    let trueMatch = 0;
    let mismatch = 0;
    for (const id of dupIds.slice(0, 20)) {
      const fromC1 = transc1.find((e: any) => e.transid === id);
      const fromT1 = trans1.find((e: any) => e.transid === id);
      const same = fromC1?.maid === fromT1?.maid && fromC1?.vid === fromT1?.vid &&
                   Number(fromC1?.dramt) === Number(fromT1?.dramt) && Number(fromC1?.cramt) === Number(fromT1?.cramt);
      if (same) trueMatch++; else { mismatch++; console.log(`  MISMATCH transid=${id}: c1 maid=${fromC1?.maid},vid=${fromC1?.vid},dr=${fromC1?.dramt} | t1 maid=${fromT1?.maid},vid=${fromT1?.vid},dr=${fromT1?.dramt}`); }
    }
    console.log(`  Of first 20 dups: ${trueMatch} truly identical, ${mismatch} mismatched`);
  }

  // Voucher overlap
  const vc1Ids = new Set(vouchersc1.map((e: any) => e.vid));
  const v1Ids = new Set(vouchers1.map((e: any) => e.vid));
  let vOverlap = 0;
  v1Ids.forEach(id => { if (vc1Ids.has(id)) vOverlap++; });
  console.log(`\n=== VOUCHER OVERLAP (all pages) ===`);
  console.log(`  True duplicate vids: ${vOverlap}`);
  console.log(`  Unique to vouchersc1 only: ${vc1Ids.size - vOverlap}`);
  console.log(`  Unique to vouchers1  only: ${v1Ids.size - vOverlap}`);
  console.log(`  CORRECT TOTAL: ${vc1Ids.size + v1Ids.size - vOverlap}`);
}

run().catch(console.error);
