import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  // Dynamically import after dotenv loads env variables
  const { initDatabase, getCapitalGains, getStoredPortfolios } = await import('../src/logic');

  console.log("Initializing database...");
  await initDatabase();
  
  const portfolios = getStoredPortfolios();
  const pfIds = portfolios.map(p => Number(p.id));
  console.log(`Portfolios: ${portfolios.length} portfolios loaded.`);
  
  console.log("\nCalculating capital gains from 2000-01-01 to 2027-01-01...");
  const results = getCapitalGains(pfIds, '2000-01-01', '2027-01-01');
  console.log(`Total transactions with capital gains: ${results.length}`);
  
  const grandfathered = results.filter(r => r.isGrandfathered);
  console.log(`\nGrandfathered trades: ${grandfathered.length}`);
  grandfathered.slice(0, 10).forEach((g, idx) => {
    console.log(`  [GF #${idx + 1}] portfolio: "${g.portfolioName}" | asset: "${g.assetName}"`);
    console.log(`    buyDate: ${g.buyDate} | sellDate: ${g.sellDate} | qty: ${g.quantity}`);
    console.log(`    buyPrice: ₹${g.buyPrice.toFixed(2)} | sellPrice: ₹${g.sellPrice.toFixed(2)}`);
    console.log(`    actualCost: ₹${g.actualCost.toFixed(2)} | adjustedCostBasis: ₹${g.costBasis.toFixed(2)}`);
    console.log(`    saleProceeds: ₹${g.saleProceeds.toFixed(2)} | gainLoss: ₹${g.gainLoss.toFixed(2)}`);
  });
  
  const indexed = results.filter(r => r.isIndexed);
  console.log(`\nIndexed trades: ${indexed.length}`);
  indexed.slice(0, 10).forEach((i, idx) => {
    console.log(`  [IDX #${idx + 1}] portfolio: "${i.portfolioName}" | asset: "${i.assetName}"`);
    console.log(`    buyDate: ${i.buyDate} | sellDate: ${i.sellDate} | qty: ${i.quantity}`);
    console.log(`    buyPrice: ₹${i.buyPrice.toFixed(2)} | sellPrice: ₹${i.sellPrice.toFixed(2)}`);
    console.log(`    actualCost: ₹${i.actualCost.toFixed(2)} | indexedCostBasis: ₹${i.costBasis.toFixed(2)}`);
    console.log(`    saleProceeds: ₹${i.saleProceeds.toFixed(2)} | gainLoss: ₹${i.gainLoss.toFixed(2)}`);
  });
}

run().catch(console.error);
