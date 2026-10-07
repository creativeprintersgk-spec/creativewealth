import { initDatabase, state } from '../src/logic.ts';
import { getBalanceSheet } from '../src/services/balanceSheet.ts';

async function run() {
  await initDatabase();
  console.log("State counts after initDatabase():");
  console.log("portfolios:", state.portfolios?.length);
  console.log("vouchersc1:", state.vouchersC1?.length);
  console.log("vouchers1:", state.vouchers1?.length);
  console.log("transc1:", state.transC1?.length);
  console.log("trans1:", state.trans1?.length);
  console.log("acmac1:", state.acmac1?.length);
  console.log("bs1:", state.bs1?.length);

  const bs = await getBalanceSheet('2025-04-01', '2026-03-31', '29');
  console.log("\nBalance Sheet for Account 29 (Unnati):");
  console.log("Total Assets:", bs.totalAssets);
  console.log("Total Liabilities:", bs.totalLiabilities);
  console.log("Difference:", bs.totalAssets - bs.totalLiabilities);

  // Print liabilities groups
  for (const l of bs.liabilities) {
    console.log(`Liab Group: ${l.name} = ${l.balance}`);
    for (const led of l.ledgers || []) {
      console.log(`  Ledger: ${led.name} (${led.id}) = ${led.balance}`);
    }
  }
}
run().catch(console.error);
