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
  vouchersC1: JSON.parse(fs.readFileSync(path.join(snapshotDir, 'vouchersc1.json'), 'utf8'))
    .filter((v: any) => v.vid !== 400)
    .map((v: any) => ({ ...v, _src: 'c' })),
  vouchers1: JSON.parse(fs.readFileSync(path.join(snapshotDir, 'vouchers1.json'), 'utf8'))
    .map((v: any) => ({ ...v, _src: 't' })),
  transC1: JSON.parse(fs.readFileSync(path.join(snapshotDir, 'transc1.json'), 'utf8'))
    .filter((e: any) => e.vid !== 400)
    .map((e: any) => ({ ...e, _src: 'c' })),
  trans1: JSON.parse(fs.readFileSync(path.join(snapshotDir, 'trans1.json'), 'utf8'))
    .map((e: any) => ({ ...e, _src: 't' })),
  mprices: [],
  scnote1: [],
  initialized: true
});

rebuildAllIndexes();

import { getBalanceSheet } from '../src/services/balanceSheet.ts';

async function check() {
  const bs = await getBalanceSheet('2025-04-01', '2026-03-31', '29');
  console.log("=== ASSETS ===");
  function printGroup(g: any, indent = "") {
    if (Math.abs(g.balance) > 0.01) {
      console.log(`${indent}${g.name}: ?${g.balance.toFixed(2)}`);
      for (const l of g.ledgers || []) {
        if (Math.abs(l.balance) > 0.01) {
          console.log(`${indent}  [Ledger ${l.id}] ${l.name}: ?${l.balance.toFixed(2)}`);
        }
      }
      for (const c of g.children || []) {
        printGroup(c, indent + "  ");
      }
    }
  }
  for (const a of bs.assets) printGroup(a);

  console.log("\n=== LIABILITIES ===");
  for (const l of bs.liabilities) printGroup(l);

  console.log("\nTOTAL ASSETS     : ?" + bs.totalAssets.toFixed(2));
  console.log("TOTAL LIABILITIES: ?" + bs.totalLiabilities.toFixed(2));
  console.log("DIFFERENCE       : ?" + (bs.totalAssets - bs.totalLiabilities).toFixed(2));
}
check().catch(console.error);
