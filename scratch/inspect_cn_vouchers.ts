import { initDatabase, getStoredVouchers, getStoredEntries, getStoredLedgers, state } from '../src/logic.ts';

async function inspectVouchers() {
  await initDatabase();
  const vouchers = getStoredVouchers().filter((v: any) => v.date === '2026-08-11');
  console.log('=== Vouchers on 2026-08-11 ===');
  for (const v of vouchers) {
    console.log(`Voucher ID: ${v.id}, No: ${v.voucherNo}, Narr: "${v.narration}"`);
    const entries = getStoredEntries().filter((e: any) => e.voucherId === v.id);
    for (const e of entries) {
      const l = getStoredLedgers().find((x: any) => String(x.id) === String(e.ledgerId));
      console.log(`   Ledger: ${e.ledgerId} ("${l?.name}"), Dr: ${e.debit}, Cr: ${e.credit}, Qty: ${e.quantity}, Price: ${e.price}`);
    }
  }
}

inspectVouchers().catch(console.error);
