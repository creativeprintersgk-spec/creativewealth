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

import { state, rebuildAllIndexes, getStoredAccounts } from '../src/logic.ts';

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

// Filter out legacy unmapped voucher 400 from 2013
Object.assign(state, {
  portfolios,
  investorGroupMembers: [],
  accPflink,
  acmac1: uniqueAcmac1,
  sam: [],
  assetMaster: [],
  bs1,
  sumTable,
  vouchersC1: vouchersC1.filter((v: any) => v.vid !== 400).map((v: any) => ({ ...v, _src: 'c' })),
  vouchers1: vouchers1.map((v: any) => ({ ...v, _src: 't' })),
  transC1: transC1.filter((e: any) => e.vid !== 400).map((e: any) => ({ ...e, _src: 'c' })),
  trans1: trans1.map((e: any) => ({ ...e, _src: 't' })),
  mprices: [],
  scnote1: [],
  initialized: true
});

rebuildAllIndexes();

import { getBalanceSheet } from '../src/services/balanceSheet.ts';

async function run() {
  const accounts = getStoredAccounts();
  for (const acc of accounts) {
    const bs = await getBalanceSheet('2025-04-01', '2026-03-31', acc.id);
    const diff = Math.abs(bs.totalAssets - bs.totalLiabilities);
    console.log(`Account ${acc.id} (${acc.accountName}):`);
    console.log(`  Assets: ₹${bs.totalAssets.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    console.log(`  Liab & Equity: ₹${bs.totalLiabilities.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    console.log(`  Diff: ₹${diff.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${diff < 0.01 ? '✅ EXACT MATCH' : '❌'}`);

    function findGroup(groups: any[], name: string): any {
      for (const g of groups) {
        if (g.name.toLowerCase().includes(name.toLowerCase())) return g;
        const found = findGroup(g.children, name);
        if (found) return found;
      }
      return null;
    }
    const sc = findGroup(bs.liabilities, 'sundry creditors') || findGroup(bs.assets, 'sundry creditors');
    console.log(`  Sundry Creditors:`, sc?.ledgers?.map((l: any) => `${l.name}: ₹${l.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`));
  }
}

run().catch(console.error);
