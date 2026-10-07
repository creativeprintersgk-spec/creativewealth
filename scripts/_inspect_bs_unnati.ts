import fs from 'fs';
import path from 'path';

const snapshotDir = path.resolve(process.cwd(), 'backups/latest_snapshot');
const portfolios = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'portfolios.json'), 'utf8'));
const accPflink = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acc_pflink.json'), 'utf8'));
const acmac1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acmac1.json'), 'utf8'));
const bs1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'bs1.json'), 'utf8'));
const sumTable = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'sum_table.json'), 'utf8'));
const vouchersC1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'vouchersc1.json'), 'utf8'));
const vouchers1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'vouchers1.json'), 'utf8'));
const transC1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'transc1.json'), 'utf8'));
const trans1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'trans1.json'), 'utf8'));

import { state, rebuildAllIndexes } from '../src/logic.ts';

const uniqueAcmac1: any[] = [];
const seenAcmac = new Set();
for (const a of acmac1) {
  if (a.name === 'Difference in Opening Balances') continue;
  const key = `${a.id}_${a.acid}_${a.is_group}`;
  if (!seenAcmac.has(key)) {
    seenAcmac.add(key);
    uniqueAcmac1.push(a);
  }
}

Object.assign(state, {
  portfolios,
  investorGroupMembers: [],
  accPflink,
  acmac1: uniqueAcmac1,
  sam: [],
  assetMaster: [],
  bs1,
  sumTable,
  vouchersC1: vouchersC1.map((v: any) => ({ ...v, _src: 'c' })),
  vouchers1: vouchers1.map((v: any) => ({ ...v, _src: 't' })),
  transC1: transC1.map((e: any) => ({ ...e, _src: 'c' })),
  trans1: trans1.map((e: any) => ({ ...e, _src: 't' })),
  mprices: [],
  scnote1: [],
  initialized: true
});

rebuildAllIndexes();

import { getBalanceSheet } from '../src/services/balanceSheet.ts';

async function run() {
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

  console.log("\nTOTAL ASSETS:", bs.totalAssets.toFixed(2));
  console.log("TOTAL LIABILITIES:", bs.totalLiabilities.toFixed(2));
  console.log("DIFF:", (bs.totalAssets - bs.totalLiabilities).toFixed(2));
}

run().catch(console.error);
