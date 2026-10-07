// Standalone verification of the XIRR engine.
// Ground truth for Test 1 computed independently via scipy.optimize.brentq
// (see conversation notes), not derived from this engine's own code.
// Run with: VITE_SUPABASE_URL=https://dummy.supabase.co VITE_SUPABASE_ANON_KEY=dummy npx tsx scripts/test-xirr-engine.ts

import { state } from '../src/logic.ts';
import { getXIRRCashFlows, computeXIRR, xirrForAsset, xirrForPortfolio, xirrForFamily } from '../src/services/xirrEngine.ts';

let failed = false;
function check(label: string, cond: boolean) {
  console.log(`${cond ? '✅ PASS' : '❌ FAIL'} — ${label}`);
  if (!cond) failed = true;
}

// Reset/seed minimal state needed for these tests
state.bs1 = [];
state.priceMap = {};
state.accPflink = [];

console.log('--- Test 1: XIRR solver matches scipy ground truth ---');
// Two buys, one sell, no remaining holding (so no current_value flow needed)
// Set up as raw cash flows directly via computeXIRR's internal solver by
// faking bs1 transactions that produce exactly this series:
//   2023-01-01: -100,000 (buy)
//   2024-01-01:  -50,000 (buy)
//   2025-06-01: +200,000 (sell, fully exits the position)
state.bs1 = [
  { pfid: 1, amid: 900, atyid: 1, trty: 20, dt: '2023-01-01', qn: 100, amt: 100000, netpr: 1000 },
  { pfid: 1, amid: 900, atyid: 1, trty: 20, dt: '2024-01-01', qn: 40, amt: 50000, netpr: 1250 },
  { pfid: 1, amid: 900, atyid: 1, trty: 99, dt: '2025-06-01', qn: 140, amt: 200000, netpr: 1428.57 },
];
const r1 = computeXIRR([1], 900, '2025-06-01');
console.log('Computed XIRR:', r1.rate, '| Expected (scipy):', 14.696);
check('Converged', r1.converged);
check(`Matches scipy ground truth within 0.01% (got ${r1.rate?.toFixed(4)}%)`, r1.rate !== null && Math.abs(r1.rate - 14.696) < 0.01);
check('No current_value flow (fully exited position)', !r1.cashFlows.some(f => f.type === 'current_value'));

console.log('\n--- Test 2: Cash dividend counts as inflow, reinvested dividend does not ---');
state.bs1 = [
  { pfid: 2, amid: 901, atyid: 1, trty: 20, dt: '2024-01-01', qn: 100, amt: 100000, netpr: 1000 },
  { pfid: 2, amid: 901, atyid: 1, trty: 62, dt: '2024-06-01', qn: 0, amt: 5000, netpr: 0 },  // cash dividend
  { pfid: 2, amid: 901, atyid: 1, trty: 35, dt: '2024-09-01', qn: 5, amt: 5500, netpr: 1100 }, // reinvested dividend (treated as buy)
];
state.priceMap = { 901: { curr: 1200 } };
const flows2 = getXIRRCashFlows([2], 901, '2025-01-01');
const divFlow = flows2.find(f => f.type === 'dividend');
const reinvestAsFlow = flows2.filter(f => f.amount < 0);
check('Cash dividend (trty=62) appears as a positive inflow', divFlow !== undefined && divFlow.amount === 5000);
check('Only ONE negative (buy) flow -- the reinvestment is NOT double-counted as a separate outflow', reinvestAsFlow.length === 1 && reinvestAsFlow[0].amount === -100000);

console.log('\n--- Test 3: Corporate actions (bonus/split/merger/demerger) excluded from cash flows ---');
state.bs1 = [
  { pfid: 3, amid: 902, atyid: 1, trty: 20, dt: '2024-01-01', qn: 100, amt: 100000, netpr: 1000 },
  { pfid: 3, amid: 902, atyid: 1, trty: 40, dt: '2024-03-01', qn: 10, amt: 0, netpr: 0 },   // bonus
  { pfid: 3, amid: 902, atyid: 1, trty: 45, dt: '2024-05-01', qn: 110, amt: 0, netpr: 0 },  // split-ish/merger-outflow no-op
  { pfid: 3, amid: 902, atyid: 1, trty: 38, dt: '2024-05-01', qn: 220, amt: 0, netpr: 0 },  // merger inflow
];
state.priceMap = { 902: { curr: 50 } };
const flows3 = getXIRRCashFlows([3], 902, '2025-01-01');
check('Only the original buy produces a cash flow (corp actions excluded)', flows3.filter(f => f.type === 'buy' || f.type === 'sell' || f.type === 'dividend').length === 1);

console.log('\n--- Test 4: Currently-held position gets a current_value flow at latest price ---');
state.bs1 = [
  { pfid: 4, amid: 903, atyid: 1, trty: 20, dt: '2024-01-01', qn: 50, amt: 50000, netpr: 1000 },
];
state.priceMap = { 903: { curr: 1300 } };
const flows4 = getXIRRCashFlows([4], 903, '2025-01-01');
const cvFlow = flows4.find(f => f.type === 'current_value');
check(`current_value flow = qty(50) * price(1300) = 65000 (got ${cvFlow?.amount})`, cvFlow !== undefined && Math.abs(cvFlow.amount - 65000) < 0.01);

console.log('\n--- Test 5: Level wrappers (asset / portfolio / family) all callable and consistent ---');
state.bs1 = [
  { pfid: 5, amid: 904, atyid: 1, trty: 20, dt: '2024-01-01', qn: 20, amt: 20000, netpr: 1000 },
  { pfid: 6, amid: 905, atyid: 1, trty: 20, dt: '2024-02-01', qn: 30, amt: 30000, netpr: 1000 },
];
state.priceMap = { 904: { curr: 1100 }, 905: { curr: 1100 } };
state.accPflink = [{ acid: 5, pfid: 6 }]; // link portfolio 5 and 6 as same family

const assetR = xirrForAsset(5, 904, '2025-01-01');
const portfolioR = xirrForPortfolio(5, '2025-01-01');
const familyR = xirrForFamily([5], '2025-01-01');

check('Per-asset XIRR computes (portfolio 5, asset 904 only)', assetR.converged && assetR.totalInvested === 20000);
check('Per-portfolio XIRR matches per-asset when portfolio has only one asset', portfolioR.totalInvested === 20000);
check('Family rollup pulls in BOTH linked portfolios (5 and 6), total invested = 50000', familyR.totalInvested === 50000);

console.log('\n--- Summary ---');
console.log(failed ? '❌ SOME CHECKS FAILED' : '✅ ALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
