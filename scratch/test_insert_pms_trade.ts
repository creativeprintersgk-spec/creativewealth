import { initDatabase, updateVoucher, getStoredAccounts, getStoredPortfolios } from '../src/logic';

async function main() {
  await initDatabase();
  const accounts = getStoredAccounts();
  const testAcc = accounts.find(a => a.id === '31'); // Saahil Shah A/c
  const portfolios = getStoredPortfolios().filter(p => p.accountId === '31');
  const testPort = portfolios[0];
  
  if (!testAcc || !testPort) {
    console.error('Missing test account or portfolio!');
    return;
  }

  console.log(`Using Account: ${testAcc.id} - ${testAcc.name}`);
  console.log(`Using Portfolio: ${testPort.id} - ${testPort.portfolioName}`);

  // Construct a realistic PMSTransactionModal save structure
  const testVoucher = {
    id: 'dummy_tx_test_123',
    date: '2026-05-28',
    type: 'journal',
    portfolioId: testPort.id,
    accountId: testAcc.id,
    narration: 'BUY 250 Bhandari Hosiery Exports @ 5.38',
    lines: [
      {
        ledgerId: '101556', // Bhandari Hosiery Exports A/c
        debit: 1345,
        credit: 0,
        quantity: 250,
        price: 5.38
      },
      {
        ledgerId: '100008', // MStock A/c (Broker / Counter Account)
        debit: 0,
        credit: 1345
      }
    ]
  };

  try {
    console.log('Calling updateVoucher with simulated trade...');
    await updateVoucher(testVoucher);
    console.log('✅ updateVoucher executed successfully!');
  } catch (err: any) {
    console.error('❌ updateVoucher failed with error:', err.message || err);
  }
}

main().catch(console.error);
