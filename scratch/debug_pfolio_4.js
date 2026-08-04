import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { initDatabase, getStoredPortfolios } = await import('../src/logic.js');

async function run() {
  console.log('Initializing database...');
  await initDatabase();

  const portfolios = getStoredPortfolios();
  const p4 = portfolios.find(p => String(p.id) === '4');
  console.log('Portfolio 4:', p4);

  const allP = portfolios.map(p => ({ id: p.id, name: p.portfolioName, accountId: p.accountId }));
  console.log('All Portfolios with accountId:', allP);
}

run().catch(console.error);
