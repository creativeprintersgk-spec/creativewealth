// Standalone verification of pre-cutoff (01-Apr-2015) opening balance consolidation.
// Run with: npx tsx scripts/test-precutoff-consolidation.ts
import { computePreCutoffOpeningPositions, resolveAssetLineToBsRow } from '../src/logic.ts';

console.log('=== Pre-Cutoff (01-Apr-2015) Opening Balance Consolidation Test Suite ===\n');
let passedChecks = 0;
let totalChecks = 0;
function assert(condition: boolean, passMsg: string, failMsg: string) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`✅ PASS — ${passMsg}`);
  } else {
    console.error(`❌ FAIL — ${failMsg}`);
  }
}

console.log('--- Check 1: Voucher 400 scenario (Fully Exited Asset vanishes completely) ---');
const v400Bs1 = [
  { trid: 17288, pfid: 2, amid: 100148, atyid: 50, trty: 20, dt: '2013-05-10', qn: 4, netpr: 2410, purpr: 2410, amt: 9640 },
  { trid: 17289, pfid: 2, amid: 100148, atyid: 50, trty: 99, dt: '2013-05-23', qn: 4, netpr: 2410, purpr: 2410, amt: 9640 },
];
const res1 = computePreCutoffOpeningPositions(v400Bs1, '2015-04-01');
const pf2Res = res1.get(2);
assert(
  !pf2Res || pf2Res.positions.length === 0,
  'Fully-exited asset (Voucher 400) leaves 0 open lots and vanishes completely (no leftover ₹9/₹1,890 artifacts)',
  `Expected 0 positions for exited asset, got ${pf2Res?.positions.length}`
);

console.log('\n--- Check 2: Still-held Asset carries forward exact quantity and cost basis ---');
const heldBs1 = [
  { trid: 1, pfid: 2, amid: 100200, atyid: 50, trty: 20, dt: '2014-06-15', qn: 100, netpr: 150, purpr: 150, amt: 15000 },
];
const res2 = computePreCutoffOpeningPositions(heldBs1, '2015-04-01');
const pf2Held = res2.get(2);
const pos2 = pf2Held?.positions.find(p => p.amid === 100200);
assert(
  !!pos2 && pos2.quantity === 100 && pos2.costBasis === 15000 && pos2.avgRate === 150,
  `Still-held asset correctly consolidated (qty=${pos2?.quantity}, cost=₹${pos2?.costBasis}, rate=₹${pos2?.avgRate})`,
  `Failed to consolidate still-held asset: ${JSON.stringify(pos2)}`
);

console.log('\n--- Check 3: Partial Sale before cutoff uses FIFO to cost remaining inventory ---');
const partialBs1 = [
  { trid: 2, pfid: 2, amid: 100300, atyid: 50, trty: 20, dt: '2013-01-10', qn: 50, netpr: 100, purpr: 100, amt: 5000 },
  { trid: 3, pfid: 2, amid: 100300, atyid: 50, trty: 20, dt: '2013-06-10', qn: 50, netpr: 200, purpr: 200, amt: 10000 },
  { trid: 4, pfid: 2, amid: 100300, atyid: 50, trty: 99, dt: '2014-01-10', qn: 60, netpr: 300, purpr: 300, amt: 18000 },
];
const res3 = computePreCutoffOpeningPositions(partialBs1, '2015-04-01');
const pos3 = res3.get(2)?.positions.find(p => p.amid === 100300);
assert(
  !!pos3 && pos3.quantity === 40 && Math.abs(pos3.costBasis - 8000) < 0.01 && Math.abs(pos3.avgRate - 200) < 0.01,
  `Partial sale FIFO remaining lot computed accurately (qty=${pos3?.quantity}, cost=₹${pos3?.costBasis}, rate=₹${pos3?.avgRate})`,
  `FIFO costing mismatch for partial sale: ${JSON.stringify(pos3)}`
);

console.log('\n--- Check 4: Post-cutoff transactions (>= 2015-04-01) are untouched and excluded ---');
const mixedDatesBs1 = [
  { trid: 5, pfid: 2, amid: 100400, atyid: 50, trty: 20, dt: '2014-12-01', qn: 10, netpr: 500, purpr: 500, amt: 5000 },
  { trid: 6, pfid: 2, amid: 100400, atyid: 50, trty: 20, dt: '2015-04-01', qn: 20, netpr: 600, purpr: 600, amt: 12000 },
  { trid: 7, pfid: 2, amid: 100400, atyid: 50, trty: 20, dt: '2016-01-15', qn: 30, netpr: 700, purpr: 700, amt: 21000 },
];
const res4 = computePreCutoffOpeningPositions(mixedDatesBs1, '2015-04-01');
const pos4 = res4.get(2)?.positions.find(p => p.amid === 100400);
assert(
  !!pos4 && pos4.quantity === 10 && pos4.costBasis === 5000,
  `Only pre-cutoff trades included in opening consolidation (qty=${pos4?.quantity}, cost=₹${pos4?.costBasis})`,
  `Post-cutoff trades leaked into opening consolidation: ${JSON.stringify(pos4)}`
);

console.log('\n--- Check 5: Multi-Portfolio Isolation ---');
const multiPfBs1 = [
  { trid: 8, pfid: 1, amid: 100500, atyid: 50, trty: 20, dt: '2014-05-01', qn: 25, netpr: 100, purpr: 100, amt: 2500 },
  { trid: 9, pfid: 2, amid: 100500, atyid: 50, trty: 20, dt: '2014-05-01', qn: 50, netpr: 100, purpr: 100, amt: 5000 },
];
const res5 = computePreCutoffOpeningPositions(multiPfBs1, '2015-04-01');
const pf1Pos = res5.get(1)?.positions.find(p => p.amid === 100500);
const pf2Pos5 = res5.get(2)?.positions.find(p => p.amid === 100500);
assert(
  !!pf1Pos && pf1Pos.quantity === 25 && !!pf2Pos5 && pf2Pos5.quantity === 50,
  `Portfolios isolated independently (PF 1 qty=${pf1Pos?.quantity}, PF 2 qty=${pf2Pos5?.quantity})`,
  `Portfolios cross-contaminated: PF1=${JSON.stringify(pf1Pos)}, PF2=${JSON.stringify(pf2Pos5)}`
);

console.log('\n--- Check 6: Multiple Assets in Single Portfolio ---');
const multiAssetBs1 = [
  { trid: 10, pfid: 3, amid: 1001, atyid: 50, trty: 20, dt: '2014-01-01', qn: 10, netpr: 100, purpr: 100, amt: 1000 },
  { trid: 11, pfid: 3, amid: 1002, atyid: 60, trty: 20, dt: '2014-02-01', qn: 20, netpr: 200, purpr: 200, amt: 4000 },
  { trid: 12, pfid: 3, amid: 1003, atyid: 50, trty: 20, dt: '2014-03-01', qn: 30, netpr: 300, purpr: 300, amt: 9000 },
  { trid: 13, pfid: 3, amid: 1003, atyid: 50, trty: 99, dt: '2014-04-01', qn: 30, netpr: 350, purpr: 350, amt: 10500 },
];
const res6 = computePreCutoffOpeningPositions(multiAssetBs1, '2015-04-01');
const pf3Consolidation = res6.get(3);
assert(
  !!pf3Consolidation &&
  pf3Consolidation.positions.length === 2 &&
  pf3Consolidation.totalCost === 5000 &&
  pf3Consolidation.positions.some(p => p.amid === 1001 && p.quantity === 10) &&
  pf3Consolidation.positions.some(p => p.amid === 1002 && p.quantity === 20) &&
  !pf3Consolidation.positions.some(p => p.amid === 1003),
  `Portfolio 3 consolidated active assets (1001, 1002) and dropped exited asset 1003 (totalCost=₹${pf3Consolidation?.totalCost})`,
  `Multi-asset consolidation mismatch: ${JSON.stringify(pf3Consolidation)}`
);

console.log('\n--- Check 7: resolveAssetLineToBsRow assigns trty=19 for Opening Balance ---');
const resolvedOpeningRow = resolveAssetLineToBsRow(
  { isOpeningBalance: true, date: '2015-04-01', narration: 'Opening Balance' },
  { amid: 1001, debit: 5000, quantity: 10, price: 500 },
  3, 9001, 12345, 1
);
assert(
  !!resolvedOpeningRow && resolvedOpeningRow.bsRow.trty === 19 && resolvedOpeningRow.bsRow.trstr === 'Opening Balance',
  `Opening Balance bs1 row correctly gets trty=19 ("Op Bal") and trstr="Opening Balance" (got trty=${resolvedOpeningRow?.bsRow.trty}, trstr="${resolvedOpeningRow?.bsRow.trstr}")`,
  `Expected trty=19, got trty=${resolvedOpeningRow?.bsRow.trty}`
);

console.log('\n--- Check 8: Capital Account Resolution & Voucher Balancing (Strict, no silent fallback) ---');
const sampleAccPflink = [{ pfid: 2, acid: 29 }];
const sampleAcmac1 = [
  { id: 105, acid: 29, name: 'Capital Account - Unnati', is_group: false },
  { id: 200, acid: 30, name: 'Capital Account - Other', is_group: false }
];
const linkPf2 = sampleAccPflink.find(l => l.pfid === 2);
const acidPf2 = linkPf2 ? Number(linkPf2.acid) : null;
const capitalLedgerPf2 = sampleAcmac1.find(a => a.acid === acidPf2 && !a.is_group && a.name.toLowerCase().includes('capital'));
const linkPf99 = sampleAccPflink.find(l => l.pfid === 99);
const acidPf99 = linkPf99 ? Number(linkPf99.acid) : null;
const capitalLedgerMissing = sampleAcmac1.find(a => a.acid === 999 && !a.is_group && a.name.toLowerCase().includes('capital'));
assert(
  acidPf2 === 29 && capitalLedgerPf2?.id === 105 && acidPf99 === null && capitalLedgerMissing === undefined,
  'Capital Account resolution is strict: resolves exact ledger (id=105 for acid=29) and rejects unlinked/missing ledgers without silent fallback',
  'Capital Account resolution allowed invalid or fallback ledger'
);

console.log('\n--- Check 9 (NEW): Zero-cost holding (e.g. bonus-only, no purchase) is NOT dropped ---');
// A pre-cutoff position that came ENTIRELY from a bonus issue (trty=40, cost=0
// per buildAssetFifoLedger's own convention) and was never sold. Before the
// fix, `totalCost > 0.000001` would have excluded this even though qty > 0 --
// silently vanishing a real holding instead of correctly carrying it forward
// at qty > 0, cost = 0 ("no purchase" = no rate, but shares still exist).
const bonusOnlyBs1 = [
  { trid: 20, pfid: 4, amid: 2001, atyid: 50, trty: 40, dt: '2014-08-01', qn: 15, netpr: 0, purpr: 0, amt: 0 },
];
const res9 = computePreCutoffOpeningPositions(bonusOnlyBs1, '2015-04-01');
const pos9 = res9.get(4)?.positions.find(p => p.amid === 2001);
assert(
  !!pos9 && pos9.quantity === 15 && pos9.costBasis === 0 && pos9.avgRate === 0,
  `Zero-cost bonus-only holding correctly carried forward (qty=${pos9?.quantity}, cost=₹${pos9?.costBasis}, rate=₹${pos9?.avgRate}) instead of being dropped`,
  `Zero-cost holding was incorrectly dropped or miscalculated: ${JSON.stringify(pos9)}`
);

console.log('\n--- Check 10 (NEW): Mixed portfolio -- zero-cost bonus asset AND normal-cost asset both survive ---');
const mixedCostBs1 = [
  { trid: 21, pfid: 5, amid: 2002, atyid: 50, trty: 40, dt: '2014-01-01', qn: 10, netpr: 0, purpr: 0, amt: 0 },   // bonus, zero cost
  { trid: 22, pfid: 5, amid: 2003, atyid: 50, trty: 20, dt: '2014-01-01', qn: 5, netpr: 100, purpr: 100, amt: 500 }, // normal buy
];
const res10 = computePreCutoffOpeningPositions(mixedCostBs1, '2015-04-01');
const pf5 = res10.get(5);
assert(
  !!pf5 && pf5.positions.length === 2 && pf5.totalCost === 500,
  `Both zero-cost and normal-cost assets survive in the same portfolio (positions=${pf5?.positions.length}, totalCost=₹${pf5?.totalCost})`,
  `Mixed-cost portfolio consolidation failed: ${JSON.stringify(pf5)}`
);

console.log(`\n=== Summary: ${passedChecks}/${totalChecks} checks passed ===`);
if (passedChecks === totalChecks && totalChecks === 10) {
  console.log('✅ ALL 10/10 CHECKS PASSED');
  process.exit(0);
} else {
  console.error('❌ SOME CHECKS FAILED');
  process.exit(1);
}
