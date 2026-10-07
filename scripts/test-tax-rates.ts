// Standalone verification of Step-3 tax-engine fixes.
// Run with: VITE_SUPABASE_URL=https://dummy.supabase.co VITE_SUPABASE_ANON_KEY=dummy npx tsx scripts/test-tax-rates.ts

import { computeAssetTax, real_estate_logic, applySection112AExemption } from '../src/services/taxEngine.ts';

let failed = false;
function check(label: string, cond: boolean) {
  console.log(`${cond ? '✅ PASS' : '❌ FAIL'} — ${label}`);
  if (!cond) failed = true;
}

console.log('--- Test 1: Equity STCG rate splits at 23-Jul-2024 ---');
// LISTED_EQUITY_SHARE (atyid default -> falls to LISTED_EQUITY_SHARE via classifyAssetCategory), held 100 days (STCG)
const preCutoffSTCG = computeAssetTax(10, 'Reliance Industries', 100000, 120000, '2024-04-01', '2024-06-01');
const postCutoffSTCG = computeAssetTax(10, 'Reliance Industries', 100000, 120000, '2025-04-01', '2025-06-01');
check(`Pre-cutoff STCG rate is 15% (got ${preCutoffSTCG.taxRate})`, preCutoffSTCG.taxRate === 15);
check(`Post-cutoff STCG rate is 20% (got ${postCutoffSTCG.taxRate})`, postCutoffSTCG.taxRate === 20);

console.log('\n--- Test 2: Equity LTCG rate splits at 23-Jul-2024 ---');
const preCutoffLTCG = computeAssetTax(10, 'Reliance Industries', 100000, 200000, '2022-01-01', '2024-06-01');
const postCutoffLTCG = computeAssetTax(10, 'Reliance Industries', 100000, 200000, '2022-01-01', '2025-06-01');
check(`Pre-cutoff LTCG rate is 10% (got ${preCutoffLTCG.taxRate})`, preCutoffLTCG.taxRate === 10);
check(`Post-cutoff LTCG rate is 12.5% (got ${postCutoffLTCG.taxRate})`, postCutoffLTCG.taxRate === 12.5);

console.log('\n--- Test 3: Real estate — no 12.5% option for pre-23-Jul-2024 sales ---');
const reOldSale = real_estate_logic(1000000, 1800000, '2015-01-01', '2024-01-01'); // sold BEFORE cutoff
check(`Pre-cutoff sale forced to 20% w/ indexation (got ${reOldSale.taxRate}%, indexationUsed=${reOldSale.indexationUsed})`, reOldSale.taxRate === 20 && reOldSale.indexationUsed === true);
check(`Pre-cutoff sale has no realEstateComparison choice object`, reOldSale.realEstateComparison === undefined);

const reTransitionSale = real_estate_logic(1000000, 1800000, '2015-01-01', '2024-08-01'); // sold AFTER cutoff, bought before
check(`Transition-window sale DOES offer the A/B choice`, reTransitionSale.realEstateComparison !== undefined);

console.log('\n--- Test 4: Section 112A exemption actually reduces estimatedTax ---');
// Two LTCG rows in the same portfolio + FY2025-26, both post-cutoff (12.5%, 1.25L limit)
// Row 1: gain 80,000 (fully within exemption)
// Row 2: gain 100,000 (exemption has 45,000 left after row 1 -> 45,000 exempt, 55,000 taxable)
const rows = [
  { portfolioId: 2, sellDate: '2025-06-01', gainType: 'LTCG', taxRate: 12.5, gainLoss: 80000, estimatedTax: 80000 * 0.125, notes: 'Eligible for Sec 112A pooled FY exemption (limit for this transfer date: ₹1,25,000)' },
  { portfolioId: 2, sellDate: '2025-09-01', gainType: 'LTCG', taxRate: 12.5, gainLoss: 100000, estimatedTax: 100000 * 0.125, notes: 'Eligible for Sec 112A pooled FY exemption (limit for this transfer date: ₹1,25,000)' },
];
const beforeTax = rows.map(r => r.estimatedTax);
applySection112AExemption(rows);
console.log('Row 1 estimatedTax before/after:', beforeTax[0].toFixed(2), '/', rows[0].estimatedTax.toFixed(2));
console.log('Row 2 estimatedTax before/after:', beforeTax[1].toFixed(2), '/', rows[1].estimatedTax.toFixed(2));
check('Row 1 (80,000 gain, fully within 1.25L limit) now has ZERO tax', rows[0].estimatedTax === 0);
check('Row 2 taxable gain is 55,000 (100,000 - 45,000 remaining exemption) -> tax = 6,875', Math.abs(rows[1].estimatedTax - 55000 * 0.125) < 0.01);
check('Tax was actually reduced from the pre-exemption estimate', rows[0].estimatedTax < beforeTax[0] && rows[1].estimatedTax < beforeTax[1]);

console.log('\n--- Summary ---');
console.log(failed ? '❌ SOME CHECKS FAILED' : '✅ ALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
