import 'dotenv/config';
import { initDatabase, getCapitalGains } from '../src/logic.ts';

async function checkHdfcCg() {
  await initDatabase();
  const txns = getCapitalGains([1], '2025-04-01', '2026-03-31');
  const hdfcTx = txns.filter((t: any) => Number(t.amid) === 100128);

  console.log('=== HDFC BANK CAPITAL GAINS MATCHED LOTS ===');
  hdfcTx.forEach((t: any) => {
    console.log(`GainType: ${t.gainType} | Buy: ${t.buyDate} @ ${t.buyPrice.toFixed(2)} | Sell: ${t.sellDate} @ ${t.sellPrice.toFixed(2)} | Qty: ${t.quantity} | Cost: ${t.costBasis.toFixed(2)} | Proceeds: ${t.saleProceeds.toFixed(2)} | Gain: ${t.gainLoss.toFixed(2)}`);
  });
}

checkHdfcCg().catch(console.error);
