import { createClient } from '@supabase/supabase-js';
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
  
  const bs = await getBalanceSheet('2025-04-01', '2026-03-31', '62');
  console.log('Total Assets:', bs.totalAssets);
  console.log('Total Liabilities:', bs.totalLiabilities);
  
  // Find Brokerage Income in liabilities tree
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
  console.log('Mediclaim:', findLedger(bs.liabilities, 'Mediclaim'));
  console.log('Kotak Bank:', findLedger(bs.assets, 'Kotak Bank (A/c No. - 7349494996)'));
}
run();
