import { supabase } from '../src/supabase';

async function fetchAll(table: string) {
  let all: any[] = [];
  let page = 0;
  const size = 1000;
  while (true) {
    const { data, error } = await supabase.from(table).select('*').range(page * size, (page + 1) * size - 1);
    if (error) {
      console.error(`Error fetching ${table}:`, error.message);
      break;
    }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < size) break;
    page++;
  }
  return all;
}

async function main() {
  console.log("Checking for unbalanced vouchers in Supabase database...");

  const [transc1, trans1, vouchersc1, vouchers1] = await Promise.all([
    fetchAll('transc1'),
    fetchAll('trans1'),
    fetchAll('vouchersc1'),
    fetchAll('vouchers1')
  ]);

  console.log(`Loaded ${transc1.length} transc1, ${trans1.length} trans1, ${vouchersc1.length} vouchersc1, ${vouchers1.length} vouchers1`);

  // Map vouchers for fast lookup
  const vchMap = new Map<number, any>();
  vouchersc1.forEach((v: any) => vchMap.set(Number(v.vid), { ...v, src: 'c' }));
  vouchers1.forEach((v: any) => vchMap.set(Number(v.vid), { ...v, src: 't' }));

  // Group transc1 by vid
  const c1Sums = new Map<number, { dr: number, cr: number }>();
  transc1.forEach((t: any) => {
    const vid = Number(t.vid);
    if (!c1Sums.has(vid)) c1Sums.set(vid, { dr: 0, cr: 0 });
    const s = c1Sums.get(vid)!;
    s.dr += Number(t.dramt) || 0;
    s.cr += Number(t.cramt) || 0;
  });

  // Group trans1 by vid
  const t1Sums = new Map<number, { dr: number, cr: number }>();
  trans1.forEach((t: any) => {
    const vid = Number(t.vid);
    if (!t1Sums.has(vid)) t1Sums.set(vid, { dr: 0, cr: 0 });
    const s = t1Sums.get(vid)!;
    s.dr += Number(t.dramt) || 0;
    s.cr += Number(t.cramt) || 0;
  });

  console.log("\n--- Unbalanced Vouchers in vouchersc1 (Capital) ---");
  let c1UnbalancedCount = 0;
  c1Sums.forEach((s, vid) => {
    const diff = Math.abs(s.dr - s.cr);
    if (diff > 0.05) {
      c1UnbalancedCount++;
      const v = vchMap.get(vid);
      console.log(`Voucher c_${vid}: Debits = ${s.dr.toFixed(2)}, Credits = ${s.cr.toFixed(2)}, Diff = ${diff.toFixed(2)} (Narration: "${v?.narr || 'No narration'}", Date: ${v?.dt})`);
    }
  });
  console.log(`Total unbalanced in vouchersc1: ${c1UnbalancedCount}`);

  console.log("\n--- Unbalanced Vouchers in vouchers1 (Trading) ---");
  let t1UnbalancedCount = 0;
  t1Sums.forEach((s, vid) => {
    const diff = Math.abs(s.dr - s.cr);
    if (diff > 0.05) {
      t1UnbalancedCount++;
      const v = vchMap.get(vid);
      console.log(`Voucher t_${vid}: Debits = ${s.dr.toFixed(2)}, Credits = ${s.cr.toFixed(2)}, Diff = ${diff.toFixed(2)} (Narration: "${v?.narr || 'No narration'}", Date: ${v?.dt})`);
    }
  });
  console.log(`Total unbalanced in vouchers1: ${t1UnbalancedCount}`);
}

main().catch(console.error);
