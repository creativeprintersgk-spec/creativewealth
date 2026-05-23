import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { config } from 'dotenv';
config({ path: path.resolve(__dirname, '../.env') });

import { initDatabase } from '../src/logic';
import { getBalanceSheet } from '../src/services/balanceSheet';

async function run() {
  await initDatabase();
  console.log('Database initialized');
  const bs = await getBalanceSheet('2025-04-01', '2026-03-31', '30');
  
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
  
  console.log('RR Broker Asset:', findLedger(bs.assets, 'RR Broker'));
  console.log('RR Broker Liab:', findLedger(bs.liabilities, 'RR Broker'));
}
run();
