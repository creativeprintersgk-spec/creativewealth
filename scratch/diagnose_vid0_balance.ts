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
    transc1: 'transid', trans1: 'transid', acmac1: 'id'
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
  console.log('=== DIAGNOSING vid=0 UNBALANCED ENTRIES (Opening Balance Issue) ===\n');

  const [trans1, acmac1] = await Promise.all([
    safeFetch('trans1'), safeFetch('acmac1')
  ]);

  console.log(`Loaded ${trans1.length} trans1 entries`);

  // Find vid=0 entries in trans1
  const vid0Entries = trans1.filter((e: any) => e.vid === 0 || e.vid === '0');
  console.log(`vid=0 entries in trans1: ${vid0Entries.length}\n`);

  const ledgerMap: Record<number, string> = {};
  acmac1.forEach((a: any) => { ledgerMap[a.id] = a.name; });

  let totalDr = 0, totalCr = 0;
  
  // Group by acid (account)
  const byAcid: Record<number, { dr: number, cr: number, entries: any[] }> = {};
  vid0Entries.forEach((e: any) => {
    const acid = e.acid || 0;
    if (!byAcid[acid]) byAcid[acid] = { dr: 0, cr: 0, entries: [] };
    byAcid[acid].dr += Number(e.dramt) || 0;
    byAcid[acid].cr += Number(e.cramt) || 0;
    byAcid[acid].entries.push(e);
    totalDr += Number(e.dramt) || 0;
    totalCr += Number(e.cramt) || 0;
  });

  console.log(`Total DR for vid=0: ₹${totalDr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
  console.log(`Total CR for vid=0: ₹${totalCr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
  console.log(`Difference: ₹${(totalDr - totalCr).toFixed(2)}\n`);

  // Show per-account balances for vid=0
  console.log('--- Per-Account Opening Balance (vid=0) ---');
  for (const [acidStr, bal] of Object.entries(byAcid)) {
    const acid = Number(acidStr);
    const diff = bal.dr - bal.cr;
    if (Math.abs(diff) > 0.01) {
      console.log(`  acid=${acid}: DR=₹${bal.dr.toFixed(2)} CR=₹${bal.cr.toFixed(2)} DIFF=₹${diff.toFixed(2)} *** UNBALANCED ***`);
      // Show the specific unbalancing entries
      bal.entries.filter((e: any) => (e.dramt > 0 || e.cramt > 0)).forEach((e: any) => {
        const name = ledgerMap[e.maid] || `maid=${e.maid}`;
        console.log(`    maid=${e.maid} (${name}): dr=${e.dramt || 0} cr=${e.cramt || 0}`);
      });
    } else {
      console.log(`  acid=${acid}: DR=₹${bal.dr.toFixed(2)} CR=₹${bal.cr.toFixed(2)} ✅`);
    }
  }

  // Also check transc1 vid=0
  console.log('\n--- Checking transc1 vid=0 entries ---');
  const [transc1] = await Promise.all([safeFetch('transc1')]);
  const transc1Vid0 = transc1.filter((e: any) => e.vid === 0 || e.vid === '0');
  
  let tc1Dr = 0, tc1Cr = 0;
  transc1Vid0.forEach((e: any) => {
    tc1Dr += Number(e.dramt) || 0;
    tc1Cr += Number(e.cramt) || 0;
  });
  console.log(`transc1 vid=0 entries: ${transc1Vid0.length}`);
  console.log(`Total DR: ₹${tc1Dr.toFixed(2)}, Total CR: ₹${tc1Cr.toFixed(2)}, Diff: ₹${(tc1Dr - tc1Cr).toFixed(2)}`);

  console.log('\n=== DONE ===');
}

run().catch(console.error);
