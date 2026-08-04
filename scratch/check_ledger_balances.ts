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
  console.log("=== SAAHIL SHAH A/C (acid=31) LEDGER BALANCES ===");

  const { data: acmac1 } = await supabase
    .from('acmac1')
    .select('id, name, parent_id, is_group, db_bal, cr_bal')
    .eq('acid', 31);

  if (!acmac1) return;

  const groups = acmac1.filter(a => a.is_group);
  const groupMap = new Map(groups.map(g => [g.id, g.name]));
  const ledgers = acmac1.filter(a => !a.is_group);

  const ledgersWithBal = ledgers.map((l: any) => {
    const db = Number(l.db_bal) || 0;
    const cr = Number(l.cr_bal) || 0;
    const bal = db - cr;
    return { ...l, bal };
  }).filter(l => Math.abs(l.bal) > 0.01);

  // Group by parent group
  const grouped: Record<string, any[]> = {};
  ledgersWithBal.forEach(l => {
    const parentName = groupMap.get(l.parent_id) || `Group ${l.parent_id}`;
    if (!grouped[parentName]) grouped[parentName] = [];
    grouped[parentName].push(l);
  });

  console.log("Active Ledgers in acmac1 grouped by parent:");
  Object.entries(grouped).forEach(([grp, list]) => {
    const total = list.reduce((sum, item) => sum + item.bal, 0);
    console.log(`\nGroup: "${grp}" (Total Balance: ${total.toFixed(2)}):`);
    list.forEach(l => {
      console.log(`  - ledger_id=${l.id} name="${l.name}" balance=${l.bal.toFixed(2)}`);
    });
  });
}
run();
