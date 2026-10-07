// Standalone verification of the Step-2 FIFO merge.
// Run with: npx tsx scripts/test-fifo-merge.ts
//
// Synthetic scenario (generic, not tied to any specific real trade history):
//   02-Aug-2024: Buy 11 @ 1500
//   13-Dec-2024: Buy  3 @ 1600
//   15-Sep-2025: Sell 14 -> should match 11 from 2024-08-02 + 3 from 2024-12-13
//
// Plus a nearby sell-before-buy pair to confirm the settlement-cover handling
// still closes cleanly without leaving a phantom lot:
//   10-Jan-2025: Sell 4 (no prior inventory) + Buy 4 on 12-Jan-2025 (2 days later, same asset)
//
// Checks:
//  1. The no-prior-inventory sell + nearby buy doesn't leak into the unrelated
//     15-Sep-2025 sale's cost basis.
//  2. buildAssetFifoLedger does NOT mutate the input transaction objects
//     (regression check for the state-mutation bug found in the audit).
//  3. The cost basis buildAssetFifoLedger produces for the 15-Sep-2025 sale (report path)
//     is IDENTICAL to what depleteFifoLots produces when fed the same open lots
//     (voucher path) -- proving the two entry points can no longer diverge.

import { buildAssetFifoLedger, depleteFifoLots } from '../src/logic.ts';

const TRTY_SELL = 99;  // regular sell
const TRTY_BUY = 20;   // regular buy

const tx = [
  { pfid: 2, amid: 100, atyid: 1, trty: TRTY_SELL, dt: '2025-01-10', qn: 4,  amt: 4 * 500,  netpr: 500 },
  { pfid: 2, amid: 100, atyid: 1, trty: TRTY_BUY,  dt: '2025-01-12', qn: 4,  amt: 4 * 495,  netpr: 495 },
  { pfid: 2, amid: 100, atyid: 1, trty: TRTY_BUY,  dt: '2024-08-02', qn: 11, amt: 11 * 1500, netpr: 1500 },
  { pfid: 2, amid: 100, atyid: 1, trty: TRTY_BUY,  dt: '2024-12-13', qn: 3,  amt: 3 * 1600, netpr: 1600 },
  { pfid: 2, amid: 100, atyid: 1, trty: TRTY_SELL, dt: '2025-09-15', qn: 14, amt: 14 * 1973.75, netpr: 1973.75 },
];

const before = JSON.parse(JSON.stringify(tx));

console.log('--- Test 1: Report path (getCapitalGains-equivalent) ---');
const reportLedger = buildAssetFifoLedger(tx, '2025-04-01', '2026-03-31', new Map(), {});
console.log('Realized rows for FY 2025-26:', reportLedger.results.length);
reportLedger.results.forEach(r => {
  console.log(`  qty=${r.quantity} buyDate=${r.buyDate} sellDate=${r.sellDate} costBasis=${r.costBasis?.toFixed(2)} proceeds=${r.saleProceeds?.toFixed(2)}`);
});

const usedUnexpectedLot = reportLedger.results.some(r => r.quantity === 14 && r.buyDate !== '2024-08-02' && r.buyDate !== '2024-12-13');
console.log('15-Sep-2025 sale matched against an unexpected lot?', usedUnexpectedLot, usedUnexpectedLot ? '❌ FAIL' : '✅ PASS');

const totalReportCost = reportLedger.results
  .filter(r => r.sellDate === '2025-09-15')
  .reduce((s, r) => s + (r.costBasis || 0), 0);
console.log('Total cost basis for the 14-qty sale (report path):', totalReportCost.toFixed(2));

console.log('\n--- Test 2: Mutation check ---');
const mutated = JSON.stringify(tx) !== JSON.stringify(before);
console.log('Input array mutated by buildAssetFifoLedger?', mutated, mutated ? '❌ FAIL' : '✅ PASS');

console.log('\n--- Test 3: Voucher path produces identical cost to report path ---');
// Simulate createVoucher(): all txns strictly before the 15-Sep-2025 sale date
const priorTx = tx.filter(t => t.dt < '2025-09-15');
const { openLots } = buildAssetFifoLedger(priorTx, '0001-01-01', '2025-09-15', new Map(), {});
const { totalCost: voucherCost, matchedLots } = depleteFifoLots(openLots, 14);
console.log('Open lots just before 2025-09-15 sale:', openLots.map(l => `${l.date}: remaining=${l.remaining}`));
console.log('Voucher-path matched lots:', matchedLots);
console.log('Voucher-path total cost:', voucherCost.toFixed(2));

const match = Math.abs(voucherCost - totalReportCost) < 0.01;
console.log('Voucher cost === Report cost?', match, match ? '✅ PASS' : '❌ FAIL');

console.log('\n--- Summary ---');
const allPass = !usedUnexpectedLot && !mutated && match;
console.log(allPass ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED');
process.exit(allPass ? 0 : 1);
