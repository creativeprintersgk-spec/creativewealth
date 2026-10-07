// Standalone verification of the bulk-import -> bs1 linkage (and the merger
// outflow bug caught while extracting the shared function).
// Run with: npx tsx scripts/test-bulk-bs1-linkage.ts

import { resolveAssetLineToBsRow, buildAssetFifoLedger, state } from '../src/logic.ts';

let failed = false;
function check(label: string, cond: boolean) {
  console.log(`${cond ? '✅ PASS' : '❌ FAIL'} — ${label}`);
  if (!cond) failed = true;
}

console.log('--- Test 1: Ordinary buy line resolves to a correct bs1 row ---');
const buyResult = resolveAssetLineToBsRow(
  { type: 'purchase', date: '2025-06-01', portfolioId: 2, narration: 'test' },
  { amid: 500, quantity: 10, price: 250, debit: 2500, tradeType: 'BUY' },
  2, 1001, 5001, 1
);
check('Resolved amid matches the line', buyResult?.amid === 500);
check(`trty is 20 (Buy) (got ${buyResult?.bsRow.trty})`, buyResult?.bsRow.trty === 20);
check(`amt is 2500 (got ${buyResult?.bsRow.amt})`, buyResult?.bsRow.amt === 2500);

console.log('\n--- Test 2: Merger INFLOW leg resolves to trty=38 (fixed) ---');
const mergerInflow = resolveAssetLineToBsRow(
  { type: 'merger', date: '2025-06-01', portfolioId: 2 },
  { amid: 600, quantity: 20, price: 300, debit: 6000, tradeType: 'BUY' },
  2, 1001, 5002, 2
);
check(`Merger inflow leg gets trty=38, NOT 45 or 99 (got ${mergerInflow?.bsRow.trty})`, mergerInflow?.bsRow.trty === 38);

console.log('\n--- Test 3: Merger OUTFLOW leg resolves to trty=45, NOT 99 (the bug caught during extraction) ---');
const mergerOutflow = resolveAssetLineToBsRow(
  { type: 'merger', date: '2025-06-01', portfolioId: 2 },
  { amid: 601, quantity: 20, price: 250, credit: 5000, tradeType: 'SELL' },
  2, 1001, 5003, 2
);
check(
  `Merger outflow leg gets trty=45 (no-op, safe), NOT 99 (which would fabricate a taxable sell) -- got ${mergerOutflow?.bsRow.trty}`,
  mergerOutflow?.bsRow.trty === 45
);

console.log('\n--- Test 4: Merger inflow (trty=38) flows correctly into the FIFO engine end-to-end ---');
// Confirms the bs1 row this function produces is actually usable by
// buildAssetFifoLedger -- not just structurally correct in isolation.
const mergerTx = [
  { pfid: 2, amid: mergerInflow!.amid, atyid: 1, trty: mergerInflow!.bsRow.trty, dt: '2025-06-01', qn: 20, amt: 6000, netpr: 300 },
  { pfid: 2, amid: mergerInflow!.amid, atyid: 1, trty: 99, dt: '2025-10-01', qn: 20, amt: 20 * 350, netpr: 350 },
];
const ledger = buildAssetFifoLedger(mergerTx, '2025-04-01', '2026-03-31', new Map(), {});
check('Merger-sourced sale produces exactly one realized row', ledger.results.length === 1);
check(`Row is flagged needsReview (got ${ledger.results[0]?.needsReview})`, ledger.results[0]?.needsReview === true);
check(`Cost basis reflects the merger amount, 6000 (got ${ledger.results[0]?.costBasis})`, ledger.results[0]?.costBasis === 6000);

console.log('\n--- Test 5: Line with no resolvable amid returns null (skipped, not crashed) ---');
const noAmidResult = resolveAssetLineToBsRow(
  { type: 'purchase', date: '2025-06-01', portfolioId: 2 },
  { ledgerId: undefined, quantity: 5, price: 100 },
  2, 1001, 5004, 1
);
check('Returns null rather than throwing when amid cannot be resolved', noAmidResult === null);

console.log('\n--- Summary ---');
console.log(failed ? '❌ SOME CHECKS FAILED' : '✅ ALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
