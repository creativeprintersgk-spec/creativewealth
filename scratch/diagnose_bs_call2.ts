import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { config } from 'dotenv';
config({ path: path.resolve(__dirname, '../.env') });

import { initDatabase, getStoredLedgers, getStoredGroups } from '../src/logic';
import { getBalanceSheet } from '../src/services/balanceSheet';

async function run() {
  await initDatabase();
  console.log('Database initialized');
  const ledgers = getStoredLedgers("62");
  const groups = getStoredGroups("62");
  console.log(`Loaded ${ledgers.length} ledgers and ${groups.length} groups for acid 62`);
  console.log('Does ledgers contain Brokerage Income?', ledgers.some(l => l.name === 'Brokerage Income'));
  console.log('Does groups contain Income?', groups.some(g => g.name === 'Income'));
  
  const bs = await getBalanceSheet('2025-04-01', '2026-03-31', '62');
  console.log('Total Assets:', bs.totalAssets);
  console.log('Total Liabilities:', bs.totalLiabilities);
  
  const findLedger = (nodes: any[], name: string): any => {
    for (const n of nodes) {
      if (n.ledgers) {
        const found = n.ledgers.find((l: any) => l.name === name);
        if (found) return found;
      }
      if (n.children) {
        const found = findLedger(n.children, name);
        if (found) return found;
      }
    }
    return null;
  };
  
  console.log('Brokerage Income:', findLedger(bs.liabilities, 'Brokerage Income'));
  console.log('Interest On Saving Account:', findLedger(bs.liabilities, 'Interest On Saving Account'));
}
run();
