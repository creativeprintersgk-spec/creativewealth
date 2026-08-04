/**
 * Find what new entries/vouchers were added TODAY that caused a new imbalance.
 * Compare with pre-existing known imbalance of ₹12,000 in vid=0.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function safeFetch(table: string, max = 50000): Promise<any[]> {
  const pkMap: Record<string, string> = {
    transc1: 'transid', trans1: 'transid', vouchersc1: 'vid', vouchers1: 'vid', acmac1: 'id'
  };
  let all: any[] = [];
  let page = 0;
  const size = 1000;
  while (all.length < max) {
    const { data, error } = await supabase.from(table).select('*').order(pkMap[table] || 'id').range(page * size, (page + 1) * size - 1);
    if (error) { console.warn(`⚠️ ${table}:`, error.message); break; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < size) break;
    page++;
  }
  return all;
}

async function run() {
  console.log('=== FINDING TODAY\'s DIFFERENCE ===\n');
  console.log('Today\'s date (IST): 2026-05-31\n');

  const [transc1, trans1, vouchersC1, vouchers1, acmac1] = await Promise.all([
    safeFetch('transc1'), safeFetch('trans1'),
    safeFetch('vouchersc1'), safeFetch('vouchers1'),
    safeFetch('acmac1')
  ]);

  const ledgerMap: Record<number, string> = {};
  acmac1.forEach((a: any) => { ledgerMap[a.id] = a.name; });

  // Find vouchers created/dated today or recently (2026-05-30 or 2026-05-31)
  const today = '2026-05-31';
  const yesterday = '2026-05-30';

  const recentC1 = vouchersC1.filter((v: any) => (v.dt || v.date || '').startsWith('2026-05'));
  const recent1 = vouchers1.filter((v: any) => (v.dt || v.date || '').startsWith('2026-05'));

  console.log(`Recent vouchersc1 (May 2026): ${recentC1.length}`);
  console.log(`Recent vouchers1 (May 2026): ${recent1.length}`);

  // Check balance of ALL non-vid-0 vouchers
  const allEntries = [
    ...transc1.map((e: any) => ({ ...e, _src: 'c' })),
    ...trans1.map((e: any) => ({ ...e, _src: 't' }))
  ];

  // Group by voucher key
  const byVoucher: Record<string, { dr: number, cr: number, src: string, vid: number }> = {};
  allEntries.forEach((e: any) => {
    const key = `${e._src}_${e.vid}`;
    if (!byVoucher[key]) byVoucher[key] = { dr: 0, cr: 0, src: e._src, vid: e.vid };
    byVoucher[key].dr += Number(e.dramt) || 0;
    byVoucher[key].cr += Number(e.cramt) || 0;
  });

  // Find all unbalanced non-vid-0 vouchers
  console.log('\n--- ALL Unbalanced Vouchers (excluding vid=0) ---');
  const vcMap: Record<string, any> = {};
  vouchersC1.forEach((v: any) => { vcMap[`c_${v.vid}`] = v; });
  vouchers1.forEach((v: any) => { vcMap[`t_${v.vid}`] = v; });

  let totalNewDiff = 0;
  const unbalanced: any[] = [];

  for (const [key, bal] of Object.entries(byVoucher)) {
    if (bal.vid === 0) continue; // skip opening balance
    const diff = bal.dr - bal.cr;
    if (Math.abs(diff) > 0.01) {
      const v = vcMap[key];
      unbalanced.push({
        key,
        vid: bal.vid,
        src: bal.src === 'c' ? 'vouchersc1' : 'vouchers1',
        date: v?.dt || v?.date,
        narr: (v?.narr || v?.narration || '').substring(0, 60),
        dr: bal.dr,
        cr: bal.cr,
        diff
      });
      totalNewDiff += diff;
    }
  }

  console.log(`Found ${unbalanced.length} unbalanced vouchers:\n`);
  unbalanced.forEach(u => {
    console.log(`  vid=${u.vid} (${u.src}) date=${u.date} diff=₹${u.diff.toFixed(2)}`);
    console.log(`    DR=₹${u.dr.toFixed(2)} CR=₹${u.cr.toFixed(2)}`);
    console.log(`    "${u.narr}"`);

    // Show entries for this voucher
    const entries = allEntries.filter(e => `${e._src}_${e.vid}` === u.key);
    entries.forEach((e: any) => {
      const name = ledgerMap[e.maid] || `maid=${e.maid}`;
      if ((e.dramt || 0) > 0 || (e.cramt || 0) > 0) {
        console.log(`      Entry: maid=${e.maid} (${name}) DR=${e.dramt || 0} CR=${e.cramt || 0}`);
      }
    });
    console.log('');
  });

  console.log(`Total net difference (ex vid=0): ₹${totalNewDiff.toFixed(2)}`);
  console.log(`Known vid=0 difference: ₹12,000.00`);
  console.log(`Total system difference: ₹${(totalNewDiff + 12000).toFixed(2)}`);

  // Also check: did any new transc1 entries get inserted recently with high transid?
  const maxTransidC1 = Math.max(...transc1.map((e: any) => e.transid));
  const maxTransid1 = Math.max(...trans1.map((e: any) => e.transid));
  console.log(`\nMax transid in transc1: ${maxTransidC1}`);
  console.log(`Max transid in trans1: ${maxTransid1}`);

  // Show the 5 most recent transc1 entries
  console.log('\n--- 5 Most Recent transc1 Entries ---');
  const recentEntries = [...transc1].sort((a: any, b: any) => b.transid - a.transid).slice(0, 5);
  recentEntries.forEach((e: any) => {
    const name = ledgerMap[e.maid] || `maid=${e.maid}`;
    const v = vcMap[`c_${e.vid}`];
    console.log(`  transid=${e.transid} vid=${e.vid} date=${v?.dt || '?'} maid=${e.maid}(${name}) DR=${e.dramt||0} CR=${e.cramt||0}`);
  });

  // Show the 5 most recent trans1 entries  
  console.log('\n--- 5 Most Recent trans1 Entries ---');
  const recentEntries1 = [...trans1].sort((a: any, b: any) => b.transid - a.transid).slice(0, 5);
  recentEntries1.forEach((e: any) => {
    const name = ledgerMap[e.maid] || `maid=${e.maid}`;
    const v = vcMap[`t_${e.vid}`];
    console.log(`  transid=${e.transid} vid=${e.vid} date=${v?.dt || '?'} maid=${e.maid}(${name}) DR=${e.dramt||0} CR=${e.cramt||0}`);
  });
}

run().catch(console.error);
