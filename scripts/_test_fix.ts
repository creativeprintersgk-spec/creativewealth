import fs from 'fs';
import path from 'path';

const snapshotDir = path.resolve(process.cwd(), 'backups/latest_snapshot');
const portfolios = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'portfolios.json'), 'utf8'));
const accPflink = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acc_pflink.json'), 'utf8'));
const vouchersC1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'vouchersc1.json'), 'utf8'));
const vouchers1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'vouchers1.json'), 'utf8'));
const transC1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'transc1.json'), 'utf8'));
const trans1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'trans1.json'), 'utf8'));

import { state, rebuildAllIndexes } from '../src/logic.ts';

Object.assign(state, {
  portfolios,
  investorGroupMembers: [],
  accPflink,
  acmac1: [],
  sam: [],
  assetMaster: [],
  bs1: [],
  sumTable: [],
  vouchersC1: vouchersC1.map((v: any) => ({ ...v, _src: 'c' })),
  vouchers1: vouchers1.map((v: any) => ({ ...v, _src: 't' })),
  transC1: transC1.map((e: any) => ({ ...e, _src: 'c' })),
  trans1: trans1.map((e: any) => ({ ...e, _src: 't' })),
  mprices: [],
  scnote1: [],
  initialized: true
});

rebuildAllIndexes();

import { getStoredEntries, getStoredVouchers, getStoredPortfolios } from '../src/logic.ts';

const entries = getStoredEntries();
const vouchers = getStoredVouchers();
const voucherMap: Record<string, any> = {};
vouchers.forEach((v: any) => voucherMap[v.id] = v);

const accountId = '29';
const allPortfolios = getStoredPortfolios();
const portfolioIds = allPortfolios.filter((p: any) => p.accountId === accountId).map((p: any) => p.id);

let debit = 0, credit = 0;

entries.forEach((e: any) => {
  if (e.ledgerId === '100002') {
    const v = voucherMap[e.voucherId];
    const entryDate = e.date || v?.date;
    const entryAcid = e.accountId || v?.accountId;
    const entryPfid = v?.portfolioId;

    const isOpeningBalance = !entryDate || entryDate === '' || entryDate === 'undefined'
      || String(entryDate).startsWith('0001');

    if (accountId) {
      const belongsToAccount =
        (entryAcid === accountId) ||
        (entryPfid && portfolioIds?.includes(entryPfid));
      if (!belongsToAccount) return;
    }

    debit += e.debit || 0;
    credit += e.credit || 0;
  }
});

console.log(`With fixed account filter:`);
console.log(`DR: ${debit.toFixed(2)}, CR: ${credit.toFixed(2)}, NET: ${(debit - credit).toFixed(2)}`);
