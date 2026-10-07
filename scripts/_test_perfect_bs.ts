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

// Test for all accounts at 2026-03-31
import { getStoredEntries, getStoredVouchers, getStoredPortfolios, getStoredGroups, getStoredLedgers } from '../src/logic.ts';

const entries = getStoredEntries();
const vouchers = getStoredVouchers();
const voucherMap: Record<string, any> = {};
vouchers.forEach((v: any) => voucherMap[v.id] = v);

const allPortfolios = getStoredPortfolios();

for (const acid of ['29', '30', '31', '32', '36', '61', '62']) {
  const portfolioIds = allPortfolios.filter((p: any) => p.accountId === acid).map((p: any) => p.id);
  const groups = getStoredGroups(acid);

  const getGroupType = (groupId: string): string => {
    let current: any = groups.find((g: any) => g.id === groupId);
    while (current) {
      if (current.type) return current.type;
      current = groups.find((g: any) => g.id === current.parent);
    }
    return "ASSET";
  };

  // Compute every ledger balance by summing entries up to 2026-03-31
  const ledgerBals: Record<string, number> = {};
  entries.forEach((e: any) => {
    const v = voucherMap[e.voucherId];
    const entryDate = e.date || v?.date;
    const entryAcid = e.accountId || v?.accountId;
    const entryPfid = v?.portfolioId;

    const isOpening = !entryDate || entryDate === '' || entryDate === 'undefined' || String(entryDate).startsWith('0001');
    if (!isOpening && entryDate > '2026-03-31') return;

    const belongs = (entryAcid === acid) || (entryPfid && portfolioIds.includes(entryPfid));
    if (!belongs) return;

    const dr = e.debit || 0;
    const cr = e.credit || 0;
    ledgerBals[e.ledgerId] = (ledgerBals[e.ledgerId] || 0) + (dr - cr);
  });

  let totalAssets = 0;
  let totalLiab = 0;

  for (const [lid, netDr] of Object.entries(ledgerBals)) {
    if (Math.abs(netDr) < 0.001) continue;
    // determine if asset or liab
    // Find ledger in acmac1 or synthetic
    const acma = acmac1.find((a: any) => String(a.id) === lid && a.acid === Number(acid));
    let targetGroup = acma ? String(acma.parent_id) : '50';
    if (Number(lid) >= 500000) targetGroup = '50'; // Investment
    else if (lid === '230') targetGroup = '64'; // Capital
    else if (lid === '205') targetGroup = '55'; // Cash
    else if (['401', '405', '415', '460', '465', '470', '475', '480', '485', '490'].includes(lid)) targetGroup = '155'; // Income
    else if (['621', '650', '655', '660', '665', '670', '19'].includes(lid)) targetGroup = '160'; // Expense

    const grpType = getGroupType(targetGroup);
    if (grpType === 'ASSET') {
      totalAssets += netDr;
    } else {
      totalLiab += (-netDr); // Liability is CR - DR
    }
  }

  const diff = Math.abs(totalAssets - totalLiab);
  console.log(`Account ${acid}: Assets=?${totalAssets.toFixed(2)}, Liab=?${totalLiab.toFixed(2)}, DIFF=?${diff.toFixed(2)} ${diff < 1 ? '? BALANCED' : '?'}`);
}
