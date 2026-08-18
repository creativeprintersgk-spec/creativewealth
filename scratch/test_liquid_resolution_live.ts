import 'dotenv/config';
import { initDatabase, getHoldings, getStoredPortfolios } from '../src/logic';

async function run() {
  await initDatabase();
  console.log('Database initialized.');

  const ports = getStoredPortfolios();
  const pfIds = ports.map(p => Number(p.id));

  const holdings = getHoldings(pfIds);
  console.log(`Total Holdings: ${holdings.length}`);

  const liquidFunds = holdings.filter(h => 
    h.assetName.toLowerCase().includes('liquid') ||
    h.assetName.toLowerCase().includes('edelweiss') ||
    h.assetName.toLowerCase().includes('kotak') ||
    h.assetName.toLowerCase().includes('parag')
  );

  console.log('\n--- LIQUID / MUTUAL FUNDS CLASSIFICATION RESULTS ---');
  liquidFunds.forEach(h => {
    console.log(`Asset: "${h.assetName}" | Type Code: ${h.assetType} (${h.assetTypeName})`);
  });
}

run().catch(console.error);
