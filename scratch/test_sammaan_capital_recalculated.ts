import 'dotenv/config';
import { initDatabase, getAssetTransactions, getStoredPortfolios } from '../src/logic';

async function run() {
  await initDatabase();
  console.log('Database initialized.');

  const ports = getStoredPortfolios();
  const pfIds = ports.map(p => Number(p.id));

  const ledger = getAssetTransactions(pfIds, 105464, '2014-04-01', '2027-03-31');

  console.log('\n--- SAMMAAN CAPITAL RECALCULATED TRANSACTIONS ---');
  console.log(`Opening Qty: ${ledger.openingQty}`);
  
  ledger.transactions.forEach((tx: any) => {
    console.log(`Date: ${tx.date} | Type: "${tx.type}" (trty ${tx.trty}) | Qty: ${tx.quantity} | Amount: ₹${tx.amount} | Bal. Quant: ${tx.balanceQty}`);
  });

  console.log(`\nClosing Qty: ${ledger.closingQty}`);
}

run().catch(console.error);
