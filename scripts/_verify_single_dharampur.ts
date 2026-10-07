import { initDatabase } from '../src/logic.ts';
import { getBalanceSheet } from '../src/services/balanceSheet.ts';

async function run() {
  await initDatabase();
  const bs = await getBalanceSheet('2025-04-01', '2026-03-31', '29');

  function collectLedgers(group: any): any[] {
    let list = [...(group.ledgers || [])];
    for (const ch of group.children || []) {
      list = list.concat(collectLedgers(ch));
    }
    return list;
  }

  const allAssetLedgers = bs.assets.flatMap(g => collectLedgers(g));
  const dh = allAssetLedgers.filter(l => l.name?.includes("Dharampur"));
  const jw = allAssetLedgers.filter(l => l.name?.includes("Jewellery"));

  console.log(`Dharampur count in BS Assets: ${dh.length}`);
  console.log(`Jewellery count in BS Assets: ${jw.length}`);
  console.log("Dharampur items:", dh.map(l => ({ id: l.id, name: l.name, balance: l.balance })));
  console.log("Jewellery items:", jw.map(l => ({ id: l.id, name: l.name, balance: l.balance })));
}
run();
