import 'dotenv/config';
import { initDatabase, getTrialBalance } from '../src/logic';

async function test() {
  await initDatabase();
  console.log("Database initialized. Running getTrialBalance...");
  const tb = getTrialBalance();
  console.log(`Trial balance returned ${tb.length} ledger balances.`);
  if (tb.length > 0) {
    console.log("Sample ledger entry in trial balance:", tb[0]);
    
    // Sum debits and credits
    let totalDebit = 0;
    let totalCredit = 0;
    tb.forEach((item: any) => {
      if (item) {
        totalDebit += item.debit;
        totalCredit += item.credit;
      }
    });
    console.log(`Total Debit: ${totalDebit.toFixed(2)} | Total Credit: ${totalCredit.toFixed(2)}`);
  }
}

test().catch(console.error);
