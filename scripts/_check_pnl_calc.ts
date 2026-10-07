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

import { getBalanceSheet } from '../src/services/balanceSheet.ts';

async function check() {
  const bs = await getBalanceSheet('2025-04-01', '2026-03-31', '29');

  function findLedger(g: any, id: string): any {
    for (const l of g.ledgers || []) {
      if (l.id === id) return l;
    }
    for (const c of g.children || []) {
      const found = findLedger(c, id);
      if (found) return found;
    }
    return null;
  }

  for (const id of ['401', '405', '407', '415', '460', '465', '470', '480', '650']) {
    let l = null;
    for (const liab of bs.liabilities) {
      l = findLedger(liab, id);
      if (l) break;
    }
    if (!l) {
      for (const asset of bs.assets) {
        l = findLedger(asset, id);
        if (l) break;
      }
    }
    console.log(`Ledger ${id}: found=${!!l}, balance=${l?.balance}`);
  }
}
check().catch(console.error);
