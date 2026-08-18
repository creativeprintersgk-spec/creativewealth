import 'dotenv/config';
import { initDatabase, getStoredPortfolios } from '../src/logic';
import { generateCapitalGainsDetailed } from '../src/services/capitalGainsEngine';

async function run() {
  await initDatabase();
  console.log('Database initialized.');

  const ports = getStoredPortfolios();
  const pfIds = ports.map(p => String(p.id));

  console.log('\n--- GENERATING CAPITAL GAINS DETAILED REPORT ---');
  const cgReport = generateCapitalGainsDetailed(pfIds, ['All Assets']);

  console.log(`Total Asset Classes in CG Report: ${cgReport.length}`);
  cgReport.forEach(group => {
    console.log(`\n========================================`);
    console.log(`ASSET CLASS: "${group.assetClass}"`);
    console.log(`Total Sell: ₹${group.totalSellValue.toFixed(2)} | Total Buy: ₹${group.totalBuyValue.toFixed(2)}`);
    console.log(`STCG: ₹${group.totalSTCG.toFixed(2)} | LTCG: ₹${group.totalLTCG.toFixed(2)}`);
    console.log(`Scrips Count: ${group.assets.length}`);
    console.log(`----------------------------------------`);
    group.assets.forEach(a => {
      console.log(`   - ${a.assetName} | Qty Sold: ${a.qtySold} | STCG: ₹${a.stcg.toFixed(2)} | LTCG: ₹${a.ltcg.toFixed(2)}`);
    });
  });
}

run().catch(console.error);
