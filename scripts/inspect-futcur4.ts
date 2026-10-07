import fs from 'fs';
import path from 'path';

const snapshotDir = path.resolve(process.cwd(), 'backups/latest_snapshot');
const bs1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'bs1.json'), 'utf8'));
const sumTable = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'sum_table.json'), 'utf8'));
const sam = fs.existsSync(path.join(snapshotDir, 'sam.json')) ? JSON.parse(fs.readFileSync(path.join(snapshotDir, 'sam.json'), 'utf8')) : [];
const assetMaster = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'asset_master.json'), 'utf8'));

import { state, rebuildAllIndexes, getHoldings } from '../src/logic.ts';
Object.assign(state, {
  portfolios: [{ id: 40, investor_name: 'Krisha Inv' }],
  investorGroupMembers: [],
  accPflink: [],
  acmac1: [],
  sam,
  assetMaster,
  bs1: bs1.filter((b: any) => b.pfid === 40),
  sumTable: sumTable.filter((s: any) => s.pfolio_id === 40),
  vouchersC1: [],
  vouchers1: [],
  transC1: [],
  trans1: [],
  scnote1: [],
  priceMap: {},
  assetNameMap: {},
  isinMap: {},
  initialized: true
});
rebuildAllIndexes();

console.log('sumTable for 40:');
state.sumTable.forEach((s: any) => {
  const anm = sam.find((x: any) => x.amid === s.amid)?.anm;
  console.log(`amid=${s.amid} qnt=${s.qnt} amtinv=${s.amtinv} currv=${s.currv} name=${anm}`);
});

console.log('bs1 for 40:');
const amidSet = new Set(state.bs1.map((b: any) => b.amid));
amidSet.forEach(amid => {
  const anm = sam.find((x: any) => x.amid === amid)?.anm;
  const txs = state.bs1.filter((b: any) => b.amid === amid);
  console.log(`amid=${amid} (${anm}): ${txs.length} txs`);
  if (anm?.includes('FUTCUR')) {
    console.log(txs);
  }
});
