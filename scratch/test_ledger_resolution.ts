import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const { initDatabase, getStoredLedgers, getStoredPortfolios, state } = await import('../src/logic');
  await initDatabase();

  const portfolios = getStoredPortfolios();
  console.log("Portfolios count:", portfolios.length);

  // Saahil Shah's portfolio for Bhandari (101556) is pfid=1 or similar
  const pf = portfolios.find(p => p.portfolioName.toLowerCase().includes('saahil'));
  console.log("Saahil Portfolio:", pf);

  const ledgers = getStoredLedgers();
  console.log("Total ledgers returned:", ledgers.length);

  const assetId = "101556";
  const assetLedger = ledgers.find(l => l.amid === Number(assetId)) || ledgers[0];
  
  console.log("Resolved assetLedger:", assetLedger);
  if (assetLedger) {
    console.log("Resolved assetLedger ID:", assetLedger.id);
    console.log("Resolved assetLedger name:", assetLedger.name);
    console.log("Resolved assetLedger amid:", assetLedger.amid);
  }
}

run().catch(console.error);
