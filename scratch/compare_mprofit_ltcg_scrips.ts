import 'dotenv/config';
import { initDatabase, getCapitalGains } from '../src/logic.ts';

async function compareLTCG() {
  await initDatabase();
  const txns = getCapitalGains([1], '2025-04-01', '2026-03-31');
  const ltcgTxns = txns.filter((t: any) => t.gainType === 'LTCG' && t.assetType === 50);

  const scripMap: Record<string, number> = {};
  ltcgTxns.forEach((t: any) => {
    scripMap[t.assetName] = (scripMap[t.assetName] || 0) + t.gainLoss;
  });

  console.log('=== WEALTHCORE LTCG SCRIP TOTALS ===');
  Object.entries(scripMap).forEach(([name, gain]) => {
    console.log(`${name}: ₹${gain.toFixed(2)}`);
  });
}

compareLTCG().catch(console.error);
