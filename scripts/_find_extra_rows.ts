import fs from 'fs';
import path from 'path';

const snapshotDir = path.resolve(process.cwd(), 'backups/latest_snapshot');
const trans1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'trans1.json'), 'utf8'));
const transC1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'transc1.json'), 'utf8'));

import { state, rebuildAllIndexes } from '../src/logic.ts';
Object.assign(state, {
  portfolios: [],
  investorGroupMembers: [],
  accPflink: [],
  acmac1: [],
  sam: [],
  assetMaster: [],
  bs1: [],
  sumTable: [],
  vouchersC1: [],
  vouchers1: [],
  transC1: transC1.map((e: any) => ({ ...e, _src: 'c' })),
  trans1: trans1.map((e: any) => ({ ...e, _src: 't' })),
  mprices: [],
  scnote1: [],
  initialized: true
});
rebuildAllIndexes();

import { getStoredEntries } from '../src/logic.ts';
const entries = getStoredEntries();

const t1_raw_29 = trans1.filter((t: any) => t.maid === 100002 && t.acid === 29);
const rawIds = new Set(t1_raw_29.map((t: any) => `t_${t.transid}`));

entries.forEach((e: any) => {
  if (e.ledgerId === '100002' && e.accountId === '29' && e.id.startsWith('t_')) {
    if (!rawIds.has(e.id)) {
      console.log(`EXTRA ENTRY IN getStoredEntries(): ${JSON.stringify(e)}`);
    }
  }
});
