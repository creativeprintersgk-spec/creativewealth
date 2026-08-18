import 'dotenv/config';
import { initDatabase, getCapitalGains } from '../src/logic.ts';

async function inspectPfid1LTCG() {
  await initDatabase();
  const txns = getCapitalGains([1], '2025-04-01', '2026-03-31');
  const ltcg = txns.filter((t: any) => t.gainType === 'LTCG' && t.assetType === 50);

  console.log('=== STOCKS LTCG TRADES FOR PFID 1 ===');
  ltcg.forEach((t: any) => {
    console.log(` - ${t.assetName} (PFID ${t.portfolioId}) | Sell ${t.sellDate} | Qty ${t.quantity} | Buy ${t.buyDate} @ ${t.buyPrice.toFixed(2)} | Gain: ${t.gainLoss.toFixed(2)}`);
  });
}

inspectPfid1LTCG().catch(console.error);
