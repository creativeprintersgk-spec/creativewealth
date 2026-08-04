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

async function run() {
  console.log("=== SAAHIL SHAH A/C (acid=31) GROUP TOTALS IN ACMAC1 ===");

  const { data: acmac1 } = await supabase
    .from('acmac1')
    .select('id, name, parent_id, is_group, db_bal, cr_bal, acid')
    .eq('acid', 31);

  if (!acmac1) return;

  // Deduplicate acmac1 by unique id, is_group, parent_id, acid (using same logic as initDatabase)
  const uniqueAcmac1: any[] = [];
  const seen = new Set();
  for (const a of acmac1) {
    const key = `${a.id}_${a.acid}_${a.is_group}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueAcmac1.push(a);
    }
  }

  const groups = uniqueAcmac1.filter(a => a.is_group);
  const groupMap = new Map(groups.map(g => [g.id, g.name]));
  const ledgers = uniqueAcmac1.filter(a => !a.is_group);

  const ledgersWithBal = ledgers.map((l: any) => {
    const db = Number(l.db_bal) || 0;
    const cr = Number(l.cr_bal) || 0;
    const bal = db - cr;
    return { ...l, bal };
  }).filter(l => Math.abs(l.bal) > 0.01);

  // Group by parent group and compute unique sums
  const groupedSums: Record<string, number> = {};
  const groupedLedgers: Record<string, string[]> = {};

  ledgersWithBal.forEach(l => {
    const parentName = groupMap.get(l.parent_id) || `Group ${l.parent_id}`;
    groupedSums[parentName] = (groupedSums[parentName] || 0) + l.bal;
    if (!groupedLedgers[parentName]) groupedLedgers[parentName] = [];
    groupedLedgers[parentName].push(`"${l.name}" (bal=${l.bal.toFixed(2)})`);
  });

  console.log("\nDeduplicated Ledger Balances by Group:");
  Object.entries(groupedSums).forEach(([grp, sum]) => {
    console.log(`\nGroup "${grp}" -> Total: ${sum.toFixed(2)}`);
    groupedLedgers[grp].forEach(ledgerStr => {
      console.log(`  - ${ledgerStr}`);
    });
  });
}
run();
