import { getBalanceSheet } from '../src/services/balanceSheet.ts';
import { initDatabase, state } from '../src/logic.ts';

async function check() {
  await initDatabase();
  console.log("acmac1 length:", state.acmac1?.length);

  // Check Dharampur in acmac1
  const dh = state.acmac1.filter((a: any) => a.name?.toLowerCase().includes("dharampur"));
  console.log("Dharampur in state.acmac1:", dh);

  const bs = await getBalanceSheet('2025-04-01', '2026-03-31', '29');
  console.log("BS totalAssets:", bs.totalAssets);
  console.log("BS totalLiabilities:", bs.totalLiabilities);
  console.log("Difference:", bs.totalAssets - bs.totalLiabilities);

  // Check Assets groups
  for (const a of bs.assets) {
    console.log(`Asset Group: ${a.name} (${a.id}), balance=${a.balance}`);
    for (const led of a.ledgers || []) {
      if (led.name?.toLowerCase().includes("dharampur") || led.name?.toLowerCase().includes("jewellery")) {
        console.log(`  Ledger: ${led.name} (id=${led.id}, acid=${led.acid}), bal=${led.balance}`);
      }
    }
  }
}
check().catch(console.error);
