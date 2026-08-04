// Load dotenv first
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  const { initDatabase, getHoldings, getStoredPortfolios } = await import('../src/logic');
  console.log("=== INITIALIZING DATABASE ===");
  await initDatabase();

  const portfolios = getStoredPortfolios();
  console.log(`Loaded ${portfolios.length} portfolios.`);

  // Let's get holdings for all portfolios
  const pfIds = portfolios.map(p => Number(p.id));
  const holdings = getHoldings(pfIds);

  console.log(`Generated ${holdings.length} holdings.`);

  // Search for Bhandari or assetId close to 101556 / 101558
  const match = holdings.filter(h => h.assetName.toLowerCase().includes('bhandari') || h.amid === 101556 || h.amid === 101558 || h.assetId === 101556 || h.assetId === 101558);
  console.log("Matching holdings in UI logic:");
  console.log(JSON.stringify(match, null, 2));
}

run().catch(console.error);
