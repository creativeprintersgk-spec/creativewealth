import { initDatabase, state, getStoredAccounts } from '../src/logic.ts';
import { getBalanceSheet } from '../src/services/balanceSheet.ts';

async function run() {
  await initDatabase();
  console.log("Supabase acmac1 rows:", state.acmac1.length);
  const accounts = getStoredAccounts();
  for (const acc of accounts) {
    const bs = await getBalanceSheet('2025-04-01', '2026-03-31', acc.id);
    const diff = Math.abs(bs.totalAssets - bs.totalLiabilities);
    console.log(`Account ${acc.id} (${acc.accountName}):`);
    console.log(`  Assets: ?${bs.totalAssets.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    console.log(`  Liab & Equity: ?${bs.totalLiabilities.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    console.log(`  Diff: ?${diff.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${diff < 0.01 ? '? EXACT MATCH' : '?'}`);
  }
}
run().catch(console.error);
