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

import { getStoredEntries, getStoredVouchers, getStoredPortfolios } from '../src/logic.ts';

const entries = getStoredEntries();
const vouchers = getStoredVouchers();
const voucherMap: Record<string, any> = {};
vouchers.forEach((v: any) => voucherMap[v.id] = v);

const accountId = '29';
const endDate = '2026-03-31';
const allPortfolios = getStoredPortfolios();
const portfolioIds = allPortfolios.filter((p: any) => p.accountId === accountId).map((p: any) => p.id);

// Check: if a ledger has any transactions in entries at all, hasFutureTxns = true
function getBal(lid: string) {
  let debit = 0, credit = 0;
  let hasTxBeforeEnd = false;
  let hasAnyTx = false;

  entries.forEach((e: any) => {
    if (e.ledgerId === lid) {
      hasAnyTx = true;
      const v = voucherMap[e.voucherId];
      const entryDate = e.date || v?.date;
      const entryAcid = e.accountId || v?.accountId;
      const entryPfid = v?.portfolioId;

      const isOpening = !entryDate || entryDate === '' || entryDate === 'undefined' || String(entryDate).startsWith('0001');
      if (!isOpening && entryDate > endDate) return;

      if (accountId) {
        const belongs = (entryAcid === accountId) || (entryPfid && portfolioIds.includes(entryPfid));
        if (!belongs) return;
      }

      hasTxBeforeEnd = true;
      debit += e.debit || 0;
      credit += e.credit || 0;
    }
  });

  return { debit, credit, net: debit - credit, hasTxBeforeEnd, hasAnyTx };
}

for (const lid of ['164', '167', '168', '169', '500307', '503141', '503175', '503184']) {
  const res = getBal(lid);
  console.log(`Ledger ${lid}: hasAnyTx=${res.hasAnyTx}, hasTxBeforeEnd=${res.hasTxBeforeEnd}, NET=${res.net.toFixed(2)}`);
}
