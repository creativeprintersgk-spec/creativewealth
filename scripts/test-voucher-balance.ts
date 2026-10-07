// Standalone verification of Step-5's balance-check arithmetic.
// This mirrors the exact computation inlined into createVoucher() and
// createVouchersBulk() (both require a live Supabase connection to run
// end-to-end, so this isolates and locks in just the balance logic itself).
// Run with: npx tsx scripts/test-voucher-balance.ts

let failed = false;
function check(label: string, cond: boolean) {
  console.log(`${cond ? '✅ PASS' : '❌ FAIL'} — ${label}`);
  if (!cond) failed = true;
}

const STRICT_BALANCE_TYPES = new Set(['payment', 'receipt', 'journal', 'contra', 'sale', 'sales']);

function wouldBlock(type: string, lines: { debit: number; credit: number }[]): boolean {
  if (!STRICT_BALANCE_TYPES.has(type)) return false;
  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
  return Math.abs(totalDebit - totalCredit) >= 0.01;
}

console.log('--- Test 1: Genuinely unbalanced journal voucher is blocked ---');
check(
  'Journal with debit 1000 / credit 900 is blocked',
  wouldBlock('journal', [{ debit: 1000, credit: 0 }, { debit: 0, credit: 900 }]) === true
);

console.log('\n--- Test 2: Balanced payment voucher is allowed ---');
check(
  'Payment with debit 5000 / credit 5000 is allowed',
  wouldBlock('payment', [{ debit: 5000, credit: 0 }, { debit: 0, credit: 5000 }]) === false
);

console.log('\n--- Test 3: Sale voucher with auto-booked P&L (3 lines) balances correctly ---');
// Mirrors what createVoucher actually books for a sale: debit cash/bank for
// full proceeds, credit the asset ledger for cost (removing it at cost),
// credit the gain ledger for the realized gain. Debit(proceeds) should equal
// credit(cost) + credit(gain).
check(
  'Sale: debit 21711.25 (proceeds), credit 16500 (cost) + credit 5211.25 (gain) -> balances',
  wouldBlock('sale', [
    { debit: 21711.25, credit: 0 },
    { debit: 0, credit: 16500 },
    { debit: 0, credit: 5211.25 },
  ]) === false
);

console.log('\n--- Test 4: Corporate-action types are NOT blocked even when single-sided ---');
check(
  'Split (debit=0, credit=0, quantity-only) is NOT blocked',
  wouldBlock('split', [{ debit: 0, credit: 0 }]) === false
);
check(
  'Demerger (single-sided debit, no offsetting credit) is NOT blocked',
  wouldBlock('demerger', [{ debit: 15000, credit: 0 }]) === false
);
check(
  'Bonus (debit=0, credit=0) is NOT blocked',
  wouldBlock('bonus', [{ debit: 0, credit: 0 }]) === false
);

console.log('\n--- Test 5: Floating-point rounding does not false-positive ---');
check(
  'Debit 1000.005 / credit 1000.00 (< 1 paisa diff) is allowed',
  wouldBlock('journal', [{ debit: 1000.005, credit: 0 }, { debit: 0, credit: 1000.00 }]) === false
);

console.log('\n--- Summary ---');
console.log(failed ? '❌ SOME CHECKS FAILED' : '✅ ALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
