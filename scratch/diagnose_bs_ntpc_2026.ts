import 'dotenv/config';
import { initDatabase, getStoredLedgers, getStoredAccounts } from '../src/logic';
import { getBalanceSheet } from '../src/services/balanceSheet';

async function run() {
  await initDatabase();
  console.log('Database initialized');
  
  const accounts = getStoredAccounts();
  console.log("Accounts:", accounts.map(a => `${a.id}: ${a.name}`));

  // Check NTPC in balance sheet for each account in FY 2026-2027 (current year in screenshot)
  for (const acc of accounts) {
    const bs = await getBalanceSheet('2026-04-01', '2027-03-31', acc.id);
    
    const findLedgersWithPattern = (nodes: any[], pattern: string, accList: any[] = []) => {
      for (const n of nodes) {
        if (n.ledgers) {
          n.ledgers.forEach((l: any) => {
            if (l.name.toLowerCase().includes(pattern.toLowerCase()) || Math.abs(l.balance - 14075.25) < 0.1) {
              accList.push({ ledger: l, groupName: n.name });
            }
          });
        }
        if (n.children) {
          findLedgersWithPattern(n.children, pattern, accList);
        }
      }
      return accList;
    };

    const ntpcLedgersInAssets = findLedgersWithPattern(bs.assets, 'NTPC');
    const ntpcLedgersInLiabilities = findLedgersWithPattern(bs.liabilities, 'NTPC');
    
    const allFound = [...ntpcLedgersInAssets, ...ntpcLedgersInLiabilities];
    if (allFound.length > 0) {
      console.log(`\n=== NTPC (or 14075.25) in Balance Sheet for Account ${acc.id} (${acc.name}) ===`);
      allFound.forEach(f => {
        console.log(`  Ledger: ${f.ledger.name} (id=${f.ledger.id}) under group "${f.groupName}": balance=${f.ledger.balance}`);
      });
    }
  }
}
run().catch(console.error);
