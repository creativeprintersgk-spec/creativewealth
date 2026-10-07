// Standalone verification of Step-6 fixes:
//  1. Merger inflow (trty=38) now correctly registers as a FIFO buy lot.
//  2. Intraday rows are still produced by buildAssetFifoLedger with gainType
//     'Intraday' (unchanged -- that's correct, other report code paths use
//     this), but CapitalGainsPage.tsx's own inline summary now excludes them.
//     Since that's a React component, this test verifies the underlying data
//     buildAssetFifoLedger produces still carries the gainType tag needed for
//     that filter to work, rather than re-testing React code directly.
//
// Run with: npx tsx scripts/test-step6-fixes.ts

import { buildAssetFifoLedger } from '../src/logic.ts';

let failed = false;
function check(label: string, cond: boolean) {
  console.log(`${cond ? '✅ PASS' : '❌ FAIL'} — ${label}`);
  if (!cond) failed = true;
}

console.log('--- Test 1: Merger inflow (trty=38) registers as a FIFO buy lot ---');
const mergerTx = [
  { pfid: 4, amid: 300, atyid: 1, trty: 38, dt: '2025-02-01', qn: 20, amt: 20 * 250, netpr: 250 },
  { pfid: 4, amid: 300, atyid: 1, trty: 99, dt: '2025-09-01', qn: 20, amt: 20 * 300, netpr: 300 },
];
const mergerLedger = buildAssetFifoLedger(mergerTx, '2025-04-01', '2026-03-31', new Map(), {});
check('Exactly one realized row produced from the merger-sourced sale', mergerLedger.results.length === 1);
check(`Row is correctly flagged needsReview (got ${mergerLedger.results[0]?.needsReview})`, mergerLedger.results[0]?.needsReview === true);
check(`Cost basis reflects the merger lot's recorded amount (got ${mergerLedger.results[0]?.costBasis})`, mergerLedger.results[0]?.costBasis === 5000);

console.log('\n--- Test 2: trty=45 (pure stock split, no merger involved) still behaves as corp-action, not a buy ---');
// A lone trty=45 with no paired 85 on the same day should NOT produce a
// phantom delivery lot (this was, and remains, correct split-handling behavior)
const splitOnlyTx = [
  { pfid: 4, amid: 301, atyid: 1, trty: 45, dt: '2025-02-01', qn: 20, amt: 5000, netpr: 250 },
  { pfid: 4, amid: 301, atyid: 1, trty: 99, dt: '2025-09-01', qn: 20, amt: 6000, netpr: 300 },
];
const splitLedger = buildAssetFifoLedger(splitOnlyTx, '2025-04-01', '2026-03-31', new Map(), {});
// The sell here has no delivery lot to match against (since trty=45 alone
// never becomes a buy lot), so it should show as an unmatched sell with 0 cost
// basis -- this is pre-existing, documented behavior for lone corp-action
// entries, unchanged by this fix.
check('Lone trty=45 entry does not create a phantom delivery lot for the sale to match', splitLedger.results[0]?.costBasis === 0);

console.log('\n--- Test 3: Intraday rows still carry gainType tag for downstream filtering ---');
const TRTY_BUY = 20, TRTY_SELL = 99;
const intradayTx = [
  { pfid: 4, amid: 302, atyid: 1, trty: TRTY_BUY, dt: '2025-06-10', qn: 5, amt: 5 * 100, netpr: 100 },
  { pfid: 4, amid: 302, atyid: 1, trty: TRTY_SELL, dt: '2025-06-10', qn: 5, amt: 5 * 105, netpr: 105 },
];
const intradayLedger = buildAssetFifoLedger(intradayTx, '2025-04-01', '2026-03-31', new Map(), {});
check('Same-day buy/sell produces an Intraday-tagged row', intradayLedger.results[0]?.gainType === 'Intraday');
check('Intraday row has taxRate 0 (excluded from CG summary tax totals)', intradayLedger.results[0]?.taxRate === 0);

console.log('\n--- Summary ---');
console.log(failed ? '❌ SOME CHECKS FAILED' : '✅ ALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
