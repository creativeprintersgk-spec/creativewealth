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

  let totalAssetDrMinusCr = 0;
  let totalLiabCrMinusDr = 0;
  let totalLiabDrMinusCr = 0;

  function scanA(g: any) {
    for (const l of g.ledgers || []) {
      totalAssetDrMinusCr += l.balance;
    }
    for (const c of g.children || []) scanA(c);
  }
  bs.assets.forEach(scanA);

  function scanL(g: any) {
    for (const l of g.ledgers || []) {
      totalLiabCrMinusDr += l.balance; // balance is CR - DR
      totalLiabDrMinusCr += (-l.balance);
    }
    for (const c of g.children || []) scanL(c);
  }
  bs.liabilities.forEach(scanL);

  console.log("Total Assets (DR - CR) :", totalAssetDrMinusCr.toFixed(2));
  console.log("Total Liab (CR - DR)   :", totalLiabCrMinusDr.toFixed(2));
  console.log("Total Liab (DR - CR)   :", totalLiabDrMinusCr.toFixed(2));
  console.log("Assets + Liab (DR - CR):", (totalAssetDrMinusCr + totalLiabDrMinusCr).toFixed(2));
}
check().catch(console.error);
