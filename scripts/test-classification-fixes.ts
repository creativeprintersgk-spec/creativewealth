process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://dummy.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'dummy';

import { classifyAssetCategory, computeAssetTax } from '../src/services/taxEngine.ts';
import { buildAssetFifoLedger } from '../src/logic.ts';

let failed = false;
function check(label: string, cond: boolean) {
  console.log(`${cond ? '✅ PASS' : '❌ FAIL'} — ${label}`);
  if (!cond) failed = true;
}

console.log('--- Test 1: Debt fund (atyid 61) with an unrecognized name ---');
// A real-world example of a debt-fund name that would NOT match any of the
// existing regex patterns (no "corporate bond", "short term", "liquid" etc.)
const weirdDebtFundName = 'XYZ Prudent Debt Advantage Series-II Fund';
const cat = classifyAssetCategory(61, weirdDebtFundName);
check(`Unmatched atyid=61 fund classified as DEBT_MF_SPECIFIED, not LISTED_EQUITY_SHARE (got ${cat})`, cat === 'DEBT_MF_SPECIFIED');

const taxResult = computeAssetTax(61, weirdDebtFundName, 100000, 140000, '2024-01-01', '2025-06-01'); // ~17 months held
check(`Tax result is slab-rate STCG (Sec 50AA), not equity LTCG (got gainType=${taxResult.gainType}, rate=${taxResult.taxRate})`, taxResult.gainType === 'STCG' && taxResult.taxRate === 'slab');

console.log('\n--- Test 2: Equity MF (atyid 60) still classifies correctly regardless of name ---');
const eqCat = classifyAssetCategory(60, 'Some Randomly Named Fund XYZ');
check(`atyid=60 fund still classified as EQUITY_ORIENTED_MF (got ${eqCat})`, eqCat === 'EQUITY_ORIENTED_MF');

console.log('\n--- Test 3: Merger-sourced lot gets flagged for manual review ---');
const TRTY_MERGER_BUY = 38;
const TRTY_SELL = 99;
const tx = [
  { pfid: 3, amid: 200, atyid: 1, trty: TRTY_MERGER_BUY, dt: '2025-01-15', qn: 10, amt: 10 * 500, netpr: 500 },
  { pfid: 3, amid: 200, atyid: 1, trty: TRTY_SELL, dt: '2025-09-01', qn: 10, amt: 10 * 600, netpr: 600 },
];
const ledger = buildAssetFifoLedger(tx, '2025-04-01', '2026-03-31', new Map(), {});
check('Exactly one realized row produced', ledger.results.length === 1);
const row = ledger.results[0];
check(`Row is flagged needsReview=true (got ${row?.needsReview})`, row?.needsReview === true);
check('Row notes mention merger/demerger review warning', typeof row?.notes === 'string' && row.notes.includes('merger/demerger'));

console.log('\n--- Test 4: Ordinary (non-corporate-action) buy is NOT flagged ---');
const ordinaryTx = [
  { pfid: 3, amid: 201, atyid: 1, trty: 20, dt: '2025-01-15', qn: 10, amt: 10 * 500, netpr: 500 },
  { pfid: 3, amid: 201, atyid: 1, trty: TRTY_SELL, dt: '2025-09-01', qn: 10, amt: 10 * 600, netpr: 600 },
];
const ordinaryLedger = buildAssetFifoLedger(ordinaryTx, '2025-04-01', '2026-03-31', new Map(), {});
check(`Ordinary buy/sell is NOT flagged (got needsReview=${ordinaryLedger.results[0]?.needsReview})`, !ordinaryLedger.results[0]?.needsReview);

console.log('\n--- Summary ---');
console.log(failed ? '❌ SOME CHECKS FAILED' : '✅ ALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
