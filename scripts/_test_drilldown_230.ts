import fs from 'fs';
import path from 'path';

const snapshotDir = path.resolve(process.cwd(), 'backups/latest_snapshot');
import { state, rebuildAllIndexes, getLedgerWithBalance } from '../src/logic.ts';

Object.assign(state, {
  portfolios: JSON.parse(fs.readFileSync(path.join(snapshotDir, 'portfolios.json'), 'utf8')),
  investorGroupMembers: [],
  accPflink: JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acc_pflink.json'), 'utf8')),
  acmac1: JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acmac1.json'), 'utf8')),
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

const data = getLedgerWithBalance('230', '2025-04-01', '2026-03-31', '29');
console.log("Drilldown for Capital Account (230) on Unnati (29):");
console.log("Opening Balance:", data.openingBalance);
console.log("Closing Balance:", data.closingBalance);
console.log("Transactions count:", data.transactions?.length);
console.log("Sample 3 transactions:", data.transactions?.slice(0, 3));
