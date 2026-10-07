import fs from 'fs';
import path from 'path';

const snapshotDir = path.resolve(process.cwd(), 'backups/latest_snapshot');
const acmac1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acmac1.json'), 'utf8'));

import { state, rebuildAllIndexes } from '../src/logic.ts';

Object.assign(state, {
  portfolios: JSON.parse(fs.readFileSync(path.join(snapshotDir, 'portfolios.json'), 'utf8')),
  investorGroupMembers: [],
  accPflink: JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acc_pflink.json'), 'utf8')),
  acmac1,
  sam: [],
  assetMaster: [],
  bs1: [],
  sumTable: [],
  vouchersC1: JSON.parse(fs.readFileSync(path.join(snapshotDir, 'vouchersc1.json'), 'utf8')).map((v: any) => ({ ...v, _src: 'c' })),
  vouchers1: JSON.parse(fs.readFileSync(path.join(snapshotDir, 'vouchers1.json'), 'utf8')).map((v: any) => ({ ...v, _src: 't' })),
  transC1: JSON.parse(fs.readFileSync(path.join(snapshotDir, 'transc1.json'), 'utf8')).map((e: any) => ({ ...e, _src: 'c' })),
  trans1: JSON.parse(fs.readFileSync(path.join(snapshotDir, 'trans1.json'), 'utf8')).map((e: any) => ({ ...e, _src: 't' })),
  mprices: [],
  scnote1: [],
  initialized: true
});

rebuildAllIndexes();

import { getBalanceSheet } from '../src/services/balanceSheet.ts';

async function check() {
  const bs = await getBalanceSheet('2025-04-01', '2026-03-31', '29');

  // Map of BS ledger balances (in DR - CR terms)
  const bsLidNet: Record<string, number> = {};

  function scanA(g: any) {
    for (const l of g.ledgers || []) bsLidNet[String(l.id)] = l.balance; // Asset: DR - CR
    for (const c of g.children || []) scanA(c);
  }
  bs.assets.forEach(scanA);

  function scanL(g: any) {
    for (const l of g.ledgers || []) bsLidNet[String(l.id)] = -l.balance; // Liab balance is CR - DR, so -(CR - DR) = DR - CR
    for (const c of g.children || []) scanL(c);
  }
  bs.liabilities.forEach(scanL);

  // Raw transactions DR - CR for acid 29 up to 2026-03-31
  const allEntries = [...state.transC1, ...state.trans1];
  const rawLidNet: Record<string, number> = {};
  allEntries.forEach((e: any) => {
    if (String(e.acid) !== '29') return;
    if (e.dt && !String(e.dt).startsWith('0001') && e.dt > '2026-03-31') return;
    const lid = String(e.maid);
    rawLidNet[lid] = (rawLidNet[lid] || 0) + (Number(e.dramt) || 0) - (Number(e.cramt) || 0);
  });

  console.log("=== LEDGER DISCREPANCIES (RAW vs BS) ===");
  let totalDiscrepancy = 0;
  const allLids = new Set([...Object.keys(bsLidNet), ...Object.keys(rawLidNet)]);
  for (const lid of allLids) {
    const bsVal = bsLidNet[lid] || 0;
    const rawVal = rawLidNet[lid] || 0;
    const diff = bsVal - rawVal;
    if (Math.abs(diff) > 0.05) {
      const acma = acmac1.find((a: any) => String(a.id) === lid && a.acid === 29);
      console.log(`  [${lid}] ${acma?.name || 'Unknown'}: BS_DR-CR=${bsVal.toFixed(2)}, RAW_DR-CR=${rawVal.toFixed(2)}, DIFF=${diff.toFixed(2)}`);
      totalDiscrepancy += diff;
    }
  }
  console.log(`\nTotal Discrepancy: ?${totalDiscrepancy.toFixed(2)}`);
}
check().catch(console.error);
