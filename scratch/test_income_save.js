import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { initDatabase, getStoredPortfolios } = await import('../src/logic.js');

async function test() {
  await initDatabase();

  const portfolios = getStoredPortfolios();
  const portfolioIds = [4]; // or ["4"]
  
  let accountId = undefined;
  if (portfolioIds && portfolioIds[0]) {
    const port = portfolios.find(p => String(p.id) === String(portfolioIds[0]));
    if (port) accountId = port.accountId;
  }

  console.log('Resolved accountId for 4:', accountId);
}

test().catch(console.error);
