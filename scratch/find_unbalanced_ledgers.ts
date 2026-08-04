import 'dotenv/config';
import { initDatabase, getTrialBalance, getStoredAccounts } from '../src/logic';

async function run() {
  await initDatabase();
  
  // Find Krisha A/c account ID
  const accounts = getStoredAccounts();
  const krisha = accounts.find(a => a.name.toLowerCase().includes('krisha'));
  const acid = krisha ? krisha.id : 36;
  console.log(`Using Account ID: ${acid} for Krisha A/c`);

  const tb = getTrialBalance('2027-03-31', acid);
  
  let totalDebit = 0;
  let totalCredit = 0;
  
  console.log("\n=== Ledger Balances in Trial Balance ===");
  tb.forEach((item: any) => {
    console.log(`Ledger: ${item.name} (id=${item.id}, parent_id=${item.parentId}) | dr: ${item.debit.toFixed(2)} | cr: ${item.credit.toFixed(2)}`);
    totalDebit += item.debit;
    totalCredit += item.credit;
  });
  
  console.log("\n=== Totals ===");
  console.log(`Total Debit: ${totalDebit.toFixed(2)}`);
  console.log(`Total Credit: ${totalCredit.toFixed(2)}`);
  console.log(`Difference (Debit - Credit): ${(totalDebit - totalCredit).toFixed(2)}`);
}

run().catch(console.error);
