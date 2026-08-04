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
  console.log("=== INSPECTING UNNATI SHAH GROUPS AND LEDGERS ===");

  const { data: acmac } = await supabase
    .from('acmac1')
    .select('*')
    .eq('acid', 29);
  
  if (!acmac) {
    console.log("No acmac1 records found for acid 29.");
    return;
  }

  // Deduplicate
  const seen = new Set();
  const unique = acmac.filter((a: any) => {
    const key = `${a.id}_${a.is_group}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const groups = unique.filter((a: any) => a.is_group);
  const ledgers = unique.filter((a: any) => !a.is_group);

  console.log(`Unique groups: ${groups.length}, Unique ledgers: ${ledgers.length}`);

  // Print top level groups (parent_id = 0)
  const rootGroups = groups.filter((g: any) => g.parent_id === 0);
  console.log("Root groups for Unnati Shah:", rootGroups.map((g: any) => ({
    id: g.id,
    name: g.name,
    special_type_id: g.special_type_id
  })));

  // Find the 'Profit & Loss', 'Income', 'Expenses' groups
  const plGroups = groups.filter((g: any) => g.name.toLowerCase().includes("profit") || g.name.toLowerCase().includes("income") || g.name.toLowerCase().includes("expense") || g.name.toLowerCase().includes("expenditure"));
  console.log("P&L-related groups:", plGroups.map((g: any) => ({
    id: g.id,
    name: g.name,
    parent_id: g.parent_id,
    special_type_id: g.special_type_id
  })));

  // Let's print some ledgers belonging to income or expense groups
  const expenseGroupIds = groups.filter((g: any) => g.special_type_id === 290 || g.id === 160).map((g: any) => g.id);
  const incomeGroupIds = groups.filter((g: any) => g.special_type_id === 280 || g.id === 155).map((g: any) => g.id);

  console.log("Expense group IDs:", expenseGroupIds);
  console.log("Income group IDs:", incomeGroupIds);

  const expenseLedgers = ledgers.filter((l: any) => expenseGroupIds.includes(l.parent_id));
  const incomeLedgers = ledgers.filter((l: any) => incomeGroupIds.includes(l.parent_id));

  console.log(`Expense ledgers count: ${expenseLedgers.length}, sample:`, expenseLedgers.slice(0, 5).map(l => ({ id: l.id, name: l.name, parent_id: l.parent_id })));
  console.log(`Income ledgers count: ${incomeLedgers.length}, sample:`, incomeLedgers.slice(0, 5).map(l => ({ id: l.id, name: l.name, parent_id: l.parent_id })));
}

run();
