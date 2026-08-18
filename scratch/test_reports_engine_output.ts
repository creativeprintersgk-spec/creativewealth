import 'dotenv/config';
import { initDatabase, getStoredPortfolios } from '../src/logic';
import { generatePortfolioSummary } from '../src/services/reportsEngine';

async function run() {
  await initDatabase();
  console.log('Database initialized.');

  const ports = getStoredPortfolios();
  const pfIds = ports.map(p => String(p.id));

  console.log('\n--- 1. GENERATING PORTFOLIO SUMMARY FOR ALL ASSETS ---');
  const allReport = generatePortfolioSummary(pfIds, ['All Assets']);
  allReport.forEach(group => {
    console.log(`\nGroup: "${group.assetClass}" | Total Invested: ₹${group.totalInvested.toFixed(2)} | Current Val: ₹${group.currentValue.toFixed(2)} | Items: ${group.assets.length}`);
    group.assets.slice(0, 3).forEach(a => {
      console.log(`   - ${a.name} | Qty: ${a.qty} | Invested: ₹${a.amtInvested.toFixed(2)}`);
    });
  });

  console.log('\n--- 2. GENERATING PORTFOLIO SUMMARY FOR MUTUAL FUNDS (DEBT) ONLY ---');
  const debtReport = generatePortfolioSummary(pfIds, ['Mutual Funds (Debt)']);
  debtReport.forEach(group => {
    console.log(`\nGroup: "${group.assetClass}" | Total Invested: ₹${group.totalInvested.toFixed(2)} | Current Val: ₹${group.currentValue.toFixed(2)} | Items: ${group.assets.length}`);
    group.assets.forEach(a => {
      console.log(`   - ${a.name} | Qty: ${a.qty} | Invested: ₹${a.amtInvested.toFixed(2)}`);
    });
  });
}

run().catch(console.error);
