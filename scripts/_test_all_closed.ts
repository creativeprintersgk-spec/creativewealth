import fs from 'fs';
import path from 'path';

const snapshotDir = path.resolve(process.cwd(), 'backups/latest_snapshot');
const portfolios = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'portfolios.json'), 'utf8'));
const accPflink = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acc_pflink.json'), 'utf8'));
const vouchersC1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'vouchersc1.json'), 'utf8'));
const vouchers1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'vouchers1.json'), 'utf8'));
const transC1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'transc1.json'), 'utf8'));
const trans1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'trans1.json'), 'utf8'));
const acmac1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acmac1.json'), 'utf8'));

import { state, rebuildAllIndexes } from '../src/logic.ts';

Object.assign(state, {
  portfolios,
  investorGroupMembers: [],
  accPflink,
  acmac1,
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

const allPortfolios = getStoredPortfolios();

for (const acid of ['29', '30', '31']) {
  const portfolioIds = allPortfolios.filter((p: any) => p.accountId === acid).map((p: any) => p.id);
  console.log(`\n=== ACCOUNT ${acid} ===`);

  for (const ledgerId of ['11', '100001', '100002', '100004']) {
    let dr = 0, cr = 0;
    entries.forEach((e: any) => {
      if (e.ledgerId === ledgerId) {
        const v = voucherMap[e.voucherId];
        const entryAcid = e.accountId || v?.accountId;
        const entryPfid = v?.portfolioId;

        const belongs = (entryAcid === acid) || (entryPfid && portfolioIds.includes(entryPfid));
        if (belongs) {
          dr += e.debit || 0;
          cr += e.credit || 0;
        }
      }
    });
    console.log(`  Ledger ${ledgerId}: DR=${dr.toFixed(2)}, CR=${cr.toFixed(2)}, NET=${(dr - cr).toFixed(2)}`);
  }
}
