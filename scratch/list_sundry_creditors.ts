import { initDatabase, getStoredLedgers, getStoredAccounts } from '../src/logic';

async function main() {
  await initDatabase();
  const accounts = getStoredAccounts();
  console.log('Accounts:');
  for (const acc of accounts) {
    console.log(`Account: ${acc.id} - ${acc.name}`);
    const ledgers = getStoredLedgers(acc.id);
    const creditors = ledgers.filter(l => l.groupId === '75');
    console.log('Creditors/Brokers:');
    creditors.forEach(c => {
      console.log(`  - Ledger: id=${c.id}, name="${c.name}", groupId=${c.groupId}, acid=${c.acid}`);
    });
  }
}

main().catch(console.error);
