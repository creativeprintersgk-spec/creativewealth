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
  console.log("=== DIAGNOSING LEDGERS VS HOLDINGS ===");

  // Fetch all ledgers (acmac1 where is_group = false)
  let allLedgers: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('acmac1')
      .select('id, name, parent_id, acid, is_group, special_type_id')
      .order('id')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) {
      console.error("Error fetching acmac1:", error);
      break;
    }
    if (!data || data.length === 0) break;
    allLedgers = allLedgers.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  
  const ledgers = allLedgers.filter(l => !l.is_group);
  const groups = allLedgers.filter(l => l.is_group);

  // Group Map
  const groupMap = new Map(groups.map(g => [g.id, g]));

  // Find parent names for all ledgers
  const getParentChain = (parentId: number): string[] => {
    const chain: string[] = [];
    let curr = groupMap.get(parentId);
    while (curr) {
      chain.push(curr.name);
      curr = groupMap.get(curr.parent_id);
    }
    return chain;
  };

  // Now query transc1 to calculate balances
  console.log("Fetching transc1...");
  let allTrans: any[] = [];
  page = 0;
  while (true) {
    const { data, error } = await supabase
      .from('transc1')
      .select('maid, dramt, cramt, acid')
      .order('transid')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) {
      console.error("Error fetching transc1:", error);
      break;
    }
    if (!data || data.length === 0) break;
    allTrans = allTrans.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  // Calculate balances per ledger
  const balances: Record<number, number> = {};
  allTrans.forEach(t => {
    const dr = Number(t.dramt) || 0;
    const cr = Number(t.cramt) || 0;
    balances[t.maid] = (balances[t.maid] || 0) + (dr - cr);
  });

  const activeLedgers = ledgers.filter(l => Math.abs(balances[l.id] || 0) > 0.01);
  console.log(`Total ledgers in acmac1: ${ledgers.length}`);
  console.log(`Total active ledgers (balance != 0): ${activeLedgers.length}`);

  // Print active ledgers in asset groups like bonds, debt funds, deposits, fds, properties, gold
  const interestGroups = [
    'Fixed Deposits', 'Traded Bonds', 'Mutual Funds (Debt)', 'Mutual Funds(Debt)',
    'Deposits / Loans', 'Deposits/Loans', 'Loans and Advances (Asset)', 'Properties',
    'NCD/Debentures', 'NCD / Debentures'
  ];

  console.log("\nActive Ledgers in Asset Groups:");
  activeLedgers.forEach(l => {
    const chain = getParentChain(l.parent_id);
    const hasInterestGroup = chain.some(name => interestGroups.some(ig => name.toLowerCase().includes(ig.toLowerCase())));
    if (hasInterestGroup) {
      console.log(`  id=${l.id} name="${l.name}" balance=${balances[l.id].toFixed(2)} chain=[${chain.join(' -> ')}]`);
    }
  });

  // Let's check if these active ledger IDs exist in sum_table
  console.log("\nChecking active asset ledgers in sum_table...");
  const activeLedgerIds = activeLedgers.map(l => l.id);
  const { data: sumRows } = await supabase.from('sum_table').select('*').in('amid', activeLedgerIds);
  console.log(`Matching rows in sum_table: ${sumRows?.length || 0}`);
  if (sumRows) {
    sumRows.forEach((r: any) => {
      const led = ledgers.find(l => l.id === r.amid);
      console.log(`  amid=${r.amid} (${led?.name}) qnt=${r.qnt} currv=${r.currv} atty=${r.atty}`);
    });
  }
}

run();
