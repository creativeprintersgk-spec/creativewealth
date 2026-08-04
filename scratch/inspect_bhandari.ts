import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const { initDatabase, getAssetTransactions, getStoredPortfolios } = await import('../src/logic');
  await initDatabase();
  const portfolios = getStoredPortfolios();
  const pfids = portfolios.map(p => Number(p.id));
  console.log("All Portfolio IDs:", pfids);
  
  const res = getAssetTransactions(pfids, 101556);
  console.log("Bhandari transactions from getAssetTransactions:");
  res.transactions.forEach(t => {
    console.log({
      id: t.id,
      date: t.date,
      type: t.type,
      trty: t.trty,
      quantity: t.quantity,
      price: t.price,
      amount: t.amount,
      brokerage: t.brokerage,
      balanceQty: t.balanceQty
    });
  });
  console.log("Opening Qty:", res.openingQty, "Opening Cost:", res.openingCost);
  console.log("Closing Qty:", res.closingQty, "Closing Cost:", res.closingCost);
}

run().catch(console.error);
