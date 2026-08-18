import 'dotenv/config';
import { initDatabase } from '../src/logic.ts';
import { generateCapitalGainsDetailed } from '../src/services/capitalGainsEngine.ts';

async function testLiveGui() {
  await initDatabase();
  const report = generateCapitalGainsDetailed(['1'], ['Stocks & ETFs'], '2025-04-01', '2026-03-31');

  console.log('=== LIVE CAP GAIN REPORT OUTPUT FOR SAAHIL INV ===\n');

  report.forEach(g => {
    console.log(`Asset Class: ${g.assetClass}`);
    console.log(`Total Buy Value: ₹${g.totalBuyValue.toFixed(2)}`);
    console.log(`Total Sell Value: ₹${g.totalSellValue.toFixed(2)}`);
    console.log(`Total STCG: ₹${g.totalSTCG.toFixed(2)}`);
    console.log(`Total LTCG: ₹${g.totalLTCG.toFixed(2)}`);
    
    g.assets.forEach(a => {
      console.log(`\n  Scrip: ${a.assetName}`);
      a.matches.forEach(m => {
        console.log(`    [${m.gainType}] Sell: ${m.sellDate} Qty: ${m.quantity} @ ${m.sellPrice} = ₹${m.sellValue} | Buy: ${m.buyDate} @ ${m.buyPrice} = ₹${m.buyValue} | Gain: ₹${m.gain.toFixed(2)}`);
      });
    });
  });
}

testLiveGui().catch(console.error);
