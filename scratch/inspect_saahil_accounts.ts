import { initDatabase, getStoredLedgers, getStoredAccounts } from '../src/logic';

async function main() {
  await initDatabase();
  const accounts = getStoredAccounts();
  
  const saahilAccounts = accounts.filter(a => a.name.toLowerCase().includes('saahil'));
  for (const acc of saahilAccounts) {
    console.log(`\n========================================`);
    console.log(`Account ID: ${acc.id} - Name: "${acc.name}"`);
    console.log(`========================================`);
    const ledgers = getStoredLedgers(acc.id);
    
    // Let's print bank/cash/creditor ledgers
    const filtered = ledgers.filter(l => {
      // Find group name/id
      const groupId = l.groupId;
      return groupId === '60' || groupId === '75' || groupId === 'bank' || groupId === 'cash' || groupId === 'sundry_creditors';
    });

    console.log(`Found ${filtered.length} matching ledgers:`);
    filtered.forEach(l => {
      console.log(`  - id=${l.id}, name="${l.name}", groupId=${l.groupId}`);
    });
  }
}

main().catch(console.error);
