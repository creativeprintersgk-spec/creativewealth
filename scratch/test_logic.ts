import 'dotenv/config';
import { initDatabase, getStoredFamilies, getStoredPortfolios } from '../src/logic';

async function test() {
  await initDatabase();
  console.log("Families:", getStoredFamilies().length);
  const pfs = getStoredPortfolios();
  console.log("Portfolios:", pfs.length);
  if (pfs.length > 0) {
    console.log("Sample PF:", pfs[0]);
  } else {
    console.log("NO PORTFOLIOS!");
  }
}

test();
