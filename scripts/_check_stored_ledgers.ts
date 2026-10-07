import fs from 'fs';
import path from 'path';

const snapshotDir = path.resolve(process.cwd(), 'backups/latest_snapshot');
const acmac1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acmac1.json'), 'utf8'));

import { state, rebuildAllIndexes, getStoredLedgers } from '../src/logic.ts';

Object.assign(state, {
  portfolios: JSON.parse(fs.readFileSync(path.join(snapshotDir, 'portfolios.json'), 'utf8')),
  investorGroupMembers: [],
  accPflink: JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acc_pflink.json'), 'utf8')),
  acmac1,
  sam: [],
  assetMaster: [],
  bs1: [],
  sumTable: [],
  vouchersC1: [],
  vouchers1: [],
  transC1: [],
  trans1: [],
  mprices: [],
  scnote1: [],
  initialized: true
});

rebuildAllIndexes();

const ledgers = getStoredLedgers("29");
console.log("Total ledgers for account 29:", ledgers.length);
const cap = ledgers.find(l => String(l.id) === "230");
console.log("Ledger 230 in getStoredLedgers('29'):", cap);

const anyCap = ledgers.filter(l => l.name.toLowerCase().includes("capital"));
console.log("Capital ledgers in getStoredLedgers('29'):", anyCap);

const allLedgers = getStoredLedgers();
const capAll = allLedgers.find(l => String(l.id) === "230");
console.log("Ledger 230 in getStoredLedgers():", capAll);
