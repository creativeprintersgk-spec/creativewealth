import 'dotenv/config';
import { initDatabase, getCapitalGains } from '../src/logic.ts';

async function inspectLTCG() {
  await initDatabase();
  const txns = getCapitalGains([1], '2025-04-01', '2026-03-31');
  const ltcgTxs = txns.filter((t: any) => t.gainType === 'LTCG');

  console.log('=== WEALTHCORE LTCG SCRIPS ===');
  let sumLTCG = 0;
  ltcgTxs.forEach((t: any) => {
    sumLTCG += t.gainLoss;
    console.log(`${t.assetName} (PFID ${t.portfolioId}) | Date: ${t.sellDate} | Qty: ${t.quantity} | Buy: ${t.buyDate} @ ${t.buyPrice.toFixed(2)} | Sell @ ${t.sellPrice.toFixed(2)} | Gain: ${t.gainLoss.toFixed(2)}`);
  });

  console.log('\nTOTAL WEALTHCORE LTCG:', sumLTCG.toFixed(2));
}

inspectLTCG().catch(console.error);
