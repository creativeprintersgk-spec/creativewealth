// Standalone verification of computeLedgerOpeningBalanceGaps.
// Test 1 uses the EXACT real numbers confirmed against live data (PPF UPS
// ledger, Unnati's account) -- not synthetic guesses.
// Run with: VITE_SUPABASE_URL=https://dummy.supabase.co VITE_SUPABASE_ANON_KEY=dummy npx tsx scripts/test-ledger-opening-gaps.ts

import { computeLedgerOpeningBalanceGaps } from '../src/logic.ts';

let failed = false;
function check(label: string, cond: boolean) {
  console.log(`${cond ? '✅ PASS' : '❌ FAIL'} — ${label}`);
  if (!cond) failed = true;
}

console.log('--- Test 1: Real PPF UPS scenario (confirmed against live data) ---');
const acmac1 = [
  { id: 501389, acid: 29, name: 'PPF UPS', is_group: false, db_bal: 5002297.46, cr_bal: 2329607.23 },
];
const transc1 = [
  { maid: 501389, dramt: 3899354.23, cramt: 0 },
  { maid: 501389, dramt: 0, cramt: 2329607.23 },
];
const totalDebit = transc1.reduce((s, t) => s + t.dramt, 0);
console.log(`(sanity check: constructed transc1 debit sum = ${totalDebit}, expected 3899354.23)`);

const gaps = computeLedgerOpeningBalanceGaps(acmac1, transc1);
check('Exactly one gap found', gaps.length === 1);
check(`Gap amount is ₹11,02,943.23 (got ₹${gaps[0]?.impliedOpeningBalance})`, Math.abs(gaps[0]?.impliedOpeningBalance - 1102943.23) < 0.01);
check('Gap is positive (net debit / asset-side), matching PPF being a Dr balance', gaps[0]?.impliedOpeningBalance > 0);

console.log('\n--- Test 2: Ledger with NO gap (fully imported) is not flagged ---');
const acmac1b = [{ id: 999, acid: 29, name: 'Clean Ledger', is_group: false, db_bal: 10000, cr_bal: 3000 }];
const transc1b = [
  { maid: 999, dramt: 10000, cramt: 0 },
  { maid: 999, dramt: 0, cramt: 3000 },
];
const gapsB = computeLedgerOpeningBalanceGaps(acmac1b, transc1b);
check('No gap flagged when cumulative totals match imported net exactly', gapsB.length === 0);

console.log('\n--- Test 3: Group ledgers are skipped (they carry no balance of their own) ---');
const acmac1c = [{ id: 200120, acid: 29, name: 'PPF/EPF', is_group: true, db_bal: 999999, cr_bal: 0 }];
const gapsC = computeLedgerOpeningBalanceGaps(acmac1c, []);
check('is_group=true ledgers are never flagged, regardless of their db_bal/cr_bal', gapsC.length === 0);

console.log('\n--- Test 4: Small rounding noise below threshold is ignored ---');
const acmac1d = [{ id: 888, acid: 29, name: 'Rounding Test', is_group: false, db_bal: 1000.004, cr_bal: 0 }];
const transc1d = [{ maid: 888, dramt: 1000, cramt: 0 }];
const gapsD = computeLedgerOpeningBalanceGaps(acmac1d, transc1d, 0.01);
check('A sub-paisa rounding difference (0.004) is not flagged as a real gap', gapsD.length === 0);

console.log('\n--- Test 5: Negative gap (credit-side / liability) is computed correctly ---');
const acmac1e = [{ id: 777, acid: 30, name: 'Broker Payable', is_group: false, db_bal: 1000, cr_bal: 6000 }];
const transc1e = [{ maid: 777, dramt: 1000, cramt: 1000 }];
const gapsE = computeLedgerOpeningBalanceGaps(acmac1e, transc1e);
check(`Negative gap (liability growth) computed correctly (got ₹${gapsE[0]?.impliedOpeningBalance}, expected -5000)`, gapsE[0]?.impliedOpeningBalance === -5000);

console.log('\n--- Summary ---');
console.log(failed ? '❌ SOME CHECKS FAILED' : '✅ ALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
