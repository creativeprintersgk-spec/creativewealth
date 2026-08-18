import 'dotenv/config';
import { initDatabase } from '../src/logic.ts';
import { generateCapitalGainsDetailed } from '../src/services/capitalGainsEngine.ts';

async function testFinalVerified() {
  await initDatabase();

  const report = generateCapitalGainsDetailed(['1'], ['Stocks & ETFs'], '2025-04-01', '2026-03-31');

  let stcg = 0;
  let ltcg = 0;

  report.forEach(g => {
    stcg += g.totalSTCG;
    ltcg += g.totalLTCG;
    console.log(`Class: ${g.assetClass} | STCG: ₹${g.totalSTCG.toFixed(2)} | LTCG: ₹${g.totalLTCG.toFixed(2)}`);
  });

  console.log(`\nVerified Stocks STCG: ₹${stcg.toFixed(2)}`);
  console.log(`Verified Stocks Raw LTCG (Sec 112A): ₹${ltcg.toFixed(2)}`);
  console.log(`Verified Stocks Grand Total: ₹${(stcg + ltcg).toFixed(2)}`);
}

testFinalVerified().catch(console.error);
