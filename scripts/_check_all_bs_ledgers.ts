import fs from 'fs';
import path from 'path';

const snapshotDir = path.resolve(process.cwd(), 'backups/latest_snapshot');
const transC1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'transc1.json'), 'utf8'));
const trans1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'trans1.json'), 'utf8'));
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
  transC1: transC1.map((e: any) => ({ ...e, _src: 'c' })),
  trans1: trans1.map((e: any) => ({ ...e, _src: 't' })),
  mprices: [],
  scnote1: [],
  initialized: true
});

rebuildAllIndexes();

import { getBalanceSheet } from '../src/services/balanceSheet.ts';

async function check() {
  const bs = await getBalanceSheet('2025-04-01', '2026-03-31', '29');

  const includedLids = new Set<string>();
  function scan(g: any) {
    (g.ledgers || []).forEach((l: any) => includedLids.add(String(l.id)));
    (g.children || []).forEach(scan);
  }
  bs.assets.forEach(scan);
  bs.liabilities.forEach(scan);

  // Compare with all ledgers that have transactions
  const allEntries = [...state.transC1, ...state.trans1];
  const transTotals: Record<string, number> = {};
  allEntries.forEach((e: any) => {
    if (String(e.acid) !== '29') return;
    if (e.dt && !String(e.dt).startsWith('0001') && e.dt > '2026-03-31') return;
    const lid = String(e.maid);
    transTotals[lid] = (transTotals[lid] || 0) + (Number(e.dramt)||0) - (Number(e.cramt)||0);
  });

  console.log("=== LEDGERS WITH TRANSACTIONS NOT IN BALANCE SHEET ===");
  for (const [lid, bal] of Object.entries(transTotals)) {
    if (Math.abs(bal) > 0.01 && !includedLids.has(lid)) {
      const acma = acmac1.find((a: any) => String(a.id) === lid && a.acid === 29);
      console.log(`  MISSING [${lid}] ${acma?.name || 'Unknown'}: NET=${bal.toFixed(2)}`);
    }
  }
}
check().catch(console.error);
