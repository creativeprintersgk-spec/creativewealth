import dotenv from 'dotenv';
dotenv.config();

import { initDatabase, getStoredAccounts } from '../src/logic';
import { getBalanceSheet } from '../src/services/balanceSheet';

async function test() {
  await initDatabase();
  console.log('Database initialized.');

  const accounts = getStoredAccounts();
  console.log('Accounts:', accounts.map(a => `${a.id}: ${a.accountName}`));

  for (const acc of accounts) {
    const bs = await getBalanceSheet('2025-04-01', '2026-03-31', acc.id);
    const diff = Math.abs(bs.totalAssets - bs.totalLiabilities);
    console.log(`\nAccount ${acc.id} (${acc.accountName}):`);
    console.log(`  Total Assets:      ₹${bs.totalAssets.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    console.log(`  Total Liabilities: ₹${bs.totalLiabilities.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    console.log(`  Difference:        ₹${diff.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${diff < 1 ? '✅ BALANCED' : '❌ UNBALANCED'}`);
  }
}

test();
