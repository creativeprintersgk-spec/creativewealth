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

// Let's compute ledger balance by including BOTH c_ and t_ entries
import { getStoredEntries, getStoredVouchers } from '../src/logic.ts';

const entries = getStoredEntries();
const vouchers = getStoredVouchers();
const vMap: Record<string, any> = {};
vouchers.forEach((v: any) => vMap[v.id] = v);

for (const id of [11, 13, 100001, 100002, 100004]) {
  let dr = 0, cr = 0;
  entries.forEach((e: any) => {
    if (e.ledgerId === String(id) && e.accountId === '29') {
      dr += e.debit || 0;
      cr += e.credit || 0;
    }
  });
  console.log(`Ledger ${id}: DR=${dr.toFixed(2)}, CR=${cr.toFixed(2)}, NET=${(dr - cr).toFixed(2)}`);
}
