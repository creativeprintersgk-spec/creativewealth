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
const sam = fs.existsSync(path.join(snapshotDir, 'sam.json')) ? JSON.parse(fs.readFileSync(path.join(snapshotDir, 'sam.json'), 'utf8')) : [];
const assetMaster = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'asset_master.json'), 'utf8'));

import { state, rebuildAllIndexes, getHoldings, resolveAssetType } from '../src/logic.ts';

Object.assign(state, {
  portfolios,
  investorGroupMembers: [],
  accPflink,
  acmac1,
  sam,
  assetMaster,
  bs1,
  sumTable,
  vouchersC1,
  vouchers1,
  transC1,
  trans1,
  scnote1: [],
  priceMap: {},
  assetNameMap: {},
  isinMap: {},
  initialized: true
});

rebuildAllIndexes();

const krisha = portfolios.find((p: any) => (p.name || p.investor_name || '').toLowerCase().includes('krisha'));
console.log('Krisha portfolio:', krisha);

const holdings = getHoldings([Number(krisha.id)]);
const futcur = holdings.find((h: any) => (h.assetName || '').includes('FUTCUR'));
console.log('FUTCUR in getHoldings:', futcur);

// Also search for any ledger or transaction with 404629
console.log('Searching for 404629 or 404629.31:');
const matchTransC1 = transC1.filter((t: any) => JSON.stringify(t).includes('404629') || Math.abs(Number(t.dramt) - 404629.31) < 1 || Math.abs(Number(t.cramt) - 404629.31) < 1);
console.log('matchTransC1:', matchTransC1);

const matchTrans1 = trans1.filter((t: any) => JSON.stringify(t).includes('404629') || Math.abs(Number(t.dramt) - 404629.31) < 1 || Math.abs(Number(t.cramt) - 404629.31) < 1);
console.log('matchTrans1:', matchTrans1);

const matchAcmac1 = acmac1.filter((a: any) => JSON.stringify(a).includes('404629') || Math.abs(Number(a.db_bal) - 404629.31) < 1 || Math.abs(Number(a.cr_bal) - 404629.31) < 1);
console.log('matchAcmac1:', matchAcmac1);
