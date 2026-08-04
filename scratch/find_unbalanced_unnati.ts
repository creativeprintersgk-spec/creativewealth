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
  console.log("Analyzing Unnati Shah's trading vouchers (trans1)...");

  const [acmac1, trans1] = await Promise.all([
    fetchAll('acmac1'),
    fetchAll('trans1')
  ]);

  const acid = 29;

  // Map of ledgers for fast lookup
  const ledgerMap = new Map<number, any>();
  acmac1.forEach((a: any) => ledgerMap.set(Number(a.id), a));

  // Filter Unnati's trans1 entries
  const unnatiTrans = trans1.filter((t: any) => Number(t.acid) === acid);

  // Group by vid
  const vids = Array.from(new Set(unnatiTrans.map((t: any) => Number(t.vid))));
  console.log(`Unnati has entries in ${vids.length} trading vouchers.`);

  // Find which vouchers are unbalanced for Unnati Shah
  let unbalancedCount = 0;
  for (const vid of vids) {
    const entries = trans1.filter((t: any) => Number(t.vid) === vid);
    const dr = entries.reduce((sum, e) => sum + (Number(e.dramt) || 0), 0);
    const cr = entries.reduce((sum, e) => sum + (Number(e.cramt) || 0), 0);
    const diff = Math.abs(dr - cr);

    if (diff > 0.05) {
      // Find Unnati's specific entries in this voucher
      const unnatiEntries = entries.filter((e: any) => Number(e.acid) === acid);
      const unnatiDr = unnatiEntries.reduce((sum, e) => sum + (Number(e.dramt) || 0), 0);
      const unnatiCr = unnatiEntries.reduce((sum, e) => sum + (Number(e.cramt) || 0), 0);
      const unnatiDiff = unnatiDr - unnatiCr;

      console.log(`Voucher ${vid}:`);
      console.log(`  - Entire Voucher: Total DR = ${dr.toFixed(2)}, Total CR = ${cr.toFixed(2)}, Diff = ${diff.toFixed(2)}`);
      console.log(`  - Unnati Shah (acid=29) Share: DR = ${unnatiDr.toFixed(2)}, CR = ${unnatiCr.toFixed(2)}, Diff = ${unnatiDiff.toFixed(2)}`);
      
      console.log("  - Unnati Shah Entries in this voucher:");
      unnatiEntries.forEach(e => {
        const ledg = ledgerMap.get(Number(e.maid));
        console.log(`    * Ledger: ${ledg?.name || e.maid} (maid=${e.maid}), DR: ${e.dramt}, CR: ${e.cramt}`);
      });
      unbalancedCount++;
    }
  }

  console.log(`\nFound ${unbalancedCount} unbalanced vouchers affecting Unnati Shah.`);
}

main().catch(console.error);
