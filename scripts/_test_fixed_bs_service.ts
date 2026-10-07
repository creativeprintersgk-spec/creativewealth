import { initDatabase, state, getStoredAccounts } from '../src/logic.ts';
import fs from 'fs';

async function run() {
  await initDatabase();

  let code = fs.readFileSync('src/services/balanceSheet.ts', 'utf8');

  // Replace allLedgers definition:
  code = code.replace(
    /const allLedgers = \[\s*\.\.\.getStoredLedgers\(accountId\),[\s\S]*?\n  \];/,
    `const allLedgers = getStoredLedgers(accountId);`
  );

  // Replace ledgersToInclude deduplication:
  code = code.replace(
    /allLedgers\.forEach\(\(l: any\) => \{\s*seenLids\.add\(String\(l\.id\)\);\s*ledgersToInclude\.push\(l\);\s*\}\);/,
    `allLedgers.forEach((l: any) => {
    const lidStr = String(l.id);
    if (!seenLids.has(lidStr)) {
      seenLids.add(lidStr);
      ledgersToInclude.push(l);
    }
  });`
  );

  fs.writeFileSync('src/services/_temp_fixed_bs.ts', code);

  const { getBalanceSheet } = await import('../src/services/_temp_fixed_bs.ts');

  const accounts = getStoredAccounts();
  for (const acc of accounts) {
    const bs = await getBalanceSheet('2025-04-01', '2026-03-31', acc.id);
    const diff = Math.abs(bs.totalAssets - bs.totalLiabilities);
    console.log(`Account ${acc.id} (${acc.accountName}):`);
    console.log(`  Assets: ?${bs.totalAssets.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    console.log(`  Liab & Equity: ?${bs.totalLiabilities.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    console.log(`  Diff: ?${diff.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${diff < 0.01 ? '? EXACT MATCH' : '?'}`);
  }

  fs.unlinkSync('src/services/_temp_fixed_bs.ts');
}
run().catch(console.error);
