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
  const bs = await getBalanceSheet('2026-04-01', '2026-08-31', '29');
  console.log("=== AS OF 2026-08-31 (Current Date) ===");
  console.log("Total Assets     :", bs.totalAssets.toFixed(2));
  console.log("Total Liabilities:", bs.totalLiabilities.toFixed(2));
  console.log("Difference       :", (bs.totalAssets - bs.totalLiabilities).toFixed(2));
}
check().catch(console.error);
