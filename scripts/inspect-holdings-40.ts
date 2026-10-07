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

import { state, rebuildAllIndexes, getHoldings } from '../src/logic.ts';

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

const holdings = getHoldings([40]);
console.log(`getHoldings([40]) returned ${holdings.length} assets:`);
holdings.forEach(h => {
  console.log(`amid=${h.amid} type=${h.assetType} (${h.assetTypeName}) qty=${h.quantity} avgPr=${h.avgPrice} inv=${h.amtInvested} currv=${h.currentValue} name="${h.assetName}"`);
});
