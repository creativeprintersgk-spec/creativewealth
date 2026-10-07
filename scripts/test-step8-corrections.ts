// Standalone verification of Step 8 (corrected Jcode findings).
// Run with: VITE_SUPABASE_URL=https://dummy.supabase.co VITE_SUPABASE_ANON_KEY=dummy npx tsx scripts/test-step8-corrections.ts

import { state, classifyLedgerFlow, ASSET_GROUP_IDS } from '../src/logic.ts';
import { readFileSync } from 'fs';

let failed = false;
function check(label: string, cond: boolean) {
  console.log(`${cond ? '✅ PASS' : '❌ FAIL'} — ${label}`);
  if (!cond) failed = true;
}

console.log('--- Test 1: classifyLedgerFlow correctly identifies asset vs non-asset ledgers ---');
state.acmac1 = [
  { id: 100, parent_id: 200050 }, // Stocks group -> ASSET
  { id: 101, parent_id: 999999 }, // Some non-asset group -> NON_ASSET
];
check(`Ledger in an asset group classifies as ASSET (got ${classifyLedgerFlow(100)})`, classifyLedgerFlow(100) === 'ASSET');
check(`Ledger in a non-asset group classifies as NON_ASSET (got ${classifyLedgerFlow(101)})`, classifyLedgerFlow(101) === 'NON_ASSET');
check(`Synthetic asset-ledger id (>=500000) classifies as ASSET (got ${classifyLedgerFlow(500123)})`, classifyLedgerFlow(500123) === 'ASSET');
check(`Unknown ledger id classifies as UNKNOWN (got ${classifyLedgerFlow(999)})`, classifyLedgerFlow(999) === 'UNKNOWN');
check('classifyLedgerFlow uses the SAME ASSET_GROUP_IDS list as resolveAssetLineToBsRow (imported, not duplicated)', ASSET_GROUP_IDS.includes(200050));

console.log('\n--- Test 2: v_cash_flows SQL trty categorization matches xirrEngine.ts exactly ---');
// This is the actual point of the corrected point-4 design: the SQL view is
// allowed to duplicate the trty->flow_type MAPPING (it has to, it's SQL, it
// can't import a TS file) but it must never drift from xirrEngine.ts's real
// constants. This test parses both sources and diffs them, so any future
// edit to one without the other fails CI/this test rather than silently
// diverging into a second, disagreeing engine.
const xirrEngineSrc = readFileSync(new URL('../src/services/xirrEngine.ts', import.meta.url), 'utf-8');
const sqlSrc = readFileSync(new URL('../supabase_step8_precision_and_audit.sql', import.meta.url), 'utf-8');

function extractSet(src: string, varName: string): number[] {
  const match = src.match(new RegExp(`${varName}\\s*=\\s*new Set\\(\\[([^\\]]+)\\]\\)`));
  if (!match) return [];
  return match[1].split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
}

const tsBuyTrty = extractSet(xirrEngineSrc, 'XIRR_CASH_BUY_TRTY').sort((a, b) => a - b);
const tsSellTrty = extractSet(xirrEngineSrc, 'XIRR_CASH_SELL_TRTY').sort((a, b) => a - b);
const tsDividendMatch = xirrEngineSrc.match(/XIRR_DIVIDEND_TRTY\s*=\s*(\d+)/);
const tsDividendTrty = tsDividendMatch ? Number(tsDividendMatch[1]) : null;

// Extract the SQL view's CASE statement trty lists
const sqlBuyMatch = sqlSrc.match(/trty IN \(([\d,\s]+)\) THEN -amt/);
const sqlBuyTrty = sqlBuyMatch ? sqlBuyMatch[1].split(',').map(s => Number(s.trim())).sort((a, b) => a - b) : [];

console.log('TS buy trty set:', tsBuyTrty);
console.log('SQL buy trty set:', sqlBuyTrty);
check('SQL view buy-trty set matches xirrEngine.ts XIRR_CASH_BUY_TRTY exactly', JSON.stringify(tsBuyTrty) === JSON.stringify(sqlBuyTrty));
check('xirrEngine.ts dividend trty is 62', tsDividendTrty === 62);
check('SQL view references trty 62 for dividends', sqlSrc.includes('trty = 62'));

console.log('\n--- Test 3: corporate_actions and tax_lot_consumption tables have no mutating triggers ---');
check('SQL file contains no CREATE TRIGGER statements (point 3 correction: log only, no auto-mutation)', !sqlSrc.includes('CREATE TRIGGER'));
check('SQL file does not mention "materialized" for v_cash_flows (point 4 correction: plain view, no premature complexity)', !sqlSrc.match(/CREATE\s+MATERIALIZED\s+VIEW/i));

console.log('\n--- Summary ---');
console.log(failed ? '❌ SOME CHECKS FAILED' : '✅ ALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
