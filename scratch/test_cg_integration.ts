import 'dotenv/config';
import { createVoucher, initDatabase, getStoredVouchers, getStoredEntries, getStoredTaxLots } from '../src/logic.ts';

async function testCG() {
  await initDatabase();
  
  const portfolioId = 'p1'; // Mock or real
  const assetLedgerId = 'stk_ril'; // Asian Paints in my inspection
  
  console.log("--- 1. Buying Asset ---");
  await createVoucher({
    id: 'v_buy_1',
    date: '2024-05-01',
    type: 'payment',
    portfolioId: portfolioId,
    lines: [
      { ledgerId: assetLedgerId, debit: 1000, quantity: 10, price: 100 },
      { ledgerId: 'Bank', credit: 1000 }
    ]
  });

  console.log("--- 2. Selling Asset at Profit ---");
  await createVoucher({
    id: 'v_sell_1',
    date: '2024-06-01',
    type: 'receipt',
    portfolioId: portfolioId,
    lines: [
      { ledgerId: 'Bank', debit: 1500 },
      { ledgerId: assetLedgerId, credit: 1500, quantity: 10, price: 150 }
    ]
  });

  const vouchers = getStoredVouchers();
  const sellVoucher = vouchers.find(v => v.id === 'v_sell_1');
  console.log("Voucher saved:", sellVoucher);

  const entries = getStoredEntries().filter(e => e.voucherId === 'v_sell_1');
  console.log("Entries for sell voucher:");
  entries.forEach(e => {
    console.log(`  Ledger: ${e.ledgerId}, Debit: ${e.debit}, Credit: ${e.credit}`);
  });

  const taxLots = getStoredTaxLots();
  console.log("Tax Lots state:", taxLots);
}

// Mock browser environment for logic.ts
(global as any).window = { confirm: () => true };
(global as any).alert = console.log;

testCG();
