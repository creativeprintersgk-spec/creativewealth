import 'dotenv/config';
import { initDatabase, getCapitalGains } from '../src/logic.ts';

async function debugHdfc() {
  await initDatabase();
  const txns = getCapitalGains([1], '2025-04-01', '2026-03-31');
  const hdfc = txns.filter((t: any) => Number(t.amid) === 100128);

  console.log('=== HDFC BANK CAPITAL GAINS MATCHED LOTS ===');
  hdfc.forEach((t: any) => {
    console.log(`[${t.gainType}] Sell: ${t.sellDate} Qty: ${t.quantity} @ ${t.sellPrice} = ₹${t.saleProceeds} | Buy: ${t.buyDate} @ ${t.buyPrice} = ₹${t.costBasis} | Gain: ₹${t.gainLoss.toFixed(2)}`);
  });
}

debugHdfc().catch(console.error);
