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

  // Let's sum every single ledger in the balance sheet
  let assetSum = 0;
  let liabSum = 0;

  function collectLedgers(g: any, isAsset: boolean) {
    for (const l of g.ledgers || []) {
      if (isAsset) assetSum += l.balance;
      else liabSum += l.balance;
    }
    for (const c of g.children || []) {
      collectLedgers(c, isAsset);
    }
  }

  for (const a of bs.assets) collectLedgers(a, true);
  for (const l of bs.liabilities) collectLedgers(l, false);

  console.log("Sum of ledger balances on Assets side:", assetSum.toFixed(2));
  console.log("Sum of ledger balances on Liab side  :", liabSum.toFixed(2));
  console.log("Difference:", (assetSum - liabSum).toFixed(2));

  // Now let's calculate total Dr and total Cr of all ledgers on Assets side
  // and all ledgers on Liab side
  console.log("\nTop 5 groups on Assets side:");
  for (const a of bs.assets) {
    console.log(`  ${a.name}: ${a.balance.toFixed(2)}`);
    for (const c of a.children || []) {
      console.log(`    ${c.name}: ${c.balance.toFixed(2)}`);
    }
  }

  console.log("\nTop 5 groups on Liab side:");
  for (const l of bs.liabilities) {
    console.log(`  ${l.name}: ${l.balance.toFixed(2)}`);
    for (const c of l.children || []) {
      console.log(`    ${c.name}: ${c.balance.toFixed(2)}`);
    }
  }
}
check().catch(console.error);
