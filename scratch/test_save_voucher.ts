import { initDatabase, createVoucher, getStoredAccounts } from '../src/logic';

async function main() {
  await initDatabase();
  const accounts = getStoredAccounts();
  const testAcc = accounts[0];
  if (!testAcc) {
    console.error('No accounts found!');
    return;
  }
  console.log(`Using account: ${testAcc.id} - ${testAcc.name}`);

  const data = {
    date: '2026-05-28',
    type: 'receipt',
    voucherNo: 'TESTV-0001',
    narration: 'Test voucher saving',
    accountId: testAcc.id,
    lines: [
      {
        ledgerId: '100007', // Zerodha
        debit: 100,
        credit: 0
      },
      {
        ledgerId: '100008', // MStock
        debit: 0,
        credit: 100
      }
    ]
  };

  try {
    console.log('Attempting to create voucher...');
    await createVoucher(data);
    console.log('✅ Voucher created successfully!');
  } catch (err: any) {
    console.error('❌ Failed to create voucher:', err);
  }
}

main().catch(console.error);
