import { getBalanceSheet } from '../src/services/balanceSheet.ts';
import { initDatabase, state } from '../src/logic.ts';

async function run() {
  await initDatabase();
  const bs = await getBalanceSheet('2025-04-01', '2026-03-31', '29');
  
  function findGroup(groups: any[], id: string): any {
    for (const g of groups) {
      if (String(g.id) === id) return g;
      if (g.children) {
        const found = findGroup(g.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  const g2 = findGroup(bs.assets, '2');
  console.log("Group 2 name:", g2?.name);
  console.log("Group 2 ledgers count:", g2?.ledgers?.length);
  for (const l of g2?.ledgers || []) {
    console.log(`  ledger id=${l.id}, acid=${l.acid}, name="${l.name}", bal=${l.balance}`);
  }
}
run().catch(console.error);
