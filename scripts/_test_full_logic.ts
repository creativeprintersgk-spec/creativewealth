import fs from 'fs';
import path from 'path';

const snapshotDir = path.resolve(process.cwd(), 'backups/latest_snapshot');
import { state, getLedgerWithBalance, getStoredVouchers, rebuildAllIndexes } from '../src/logic.ts';

Object.assign(state, {
  portfolios: JSON.parse(fs.readFileSync(path.join(snapshotDir, 'portfolios.json'), 'utf8')),
  accPflink: JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acc_pflink.json'), 'utf8')),
  acmac1: JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acmac1.json'), 'utf8')),
  vouchersC1: JSON.parse(fs.readFileSync(path.join(snapshotDir, 'vouchersc1.json'), 'utf8')).map((v: any) => ({ ...v, _src: 'c' })),
  vouchers1: JSON.parse(fs.readFileSync(path.join(snapshotDir, 'vouchers1.json'), 'utf8')).map((v: any) => ({ ...v, _src: 't' })),
  transC1: JSON.parse(fs.readFileSync(path.join(snapshotDir, 'transc1.json'), 'utf8')).map((e: any) => ({ ...e, _src: 'c' })),
  trans1: JSON.parse(fs.readFileSync(path.join(snapshotDir, 'trans1.json'), 'utf8')).map((e: any) => ({ ...e, _src: 't' })),
  initialized: true
});
rebuildAllIndexes();
getStoredVouchers();

const lid = "407";
const acid = "36"; 
const result = getLedgerWithBalance(lid, "2026-04-01", "2027-03-31", acid);
console.log("Acid 36 - Opening Balance:", result.openingBalance);
console.log("Acid 36 - Tx count:", result.transactions.length);

const result2 = getLedgerWithBalance(lid, "2026-04-01", "2027-03-31", "29");
console.log("Acid 29 - Opening Balance:", result2.openingBalance);
console.log("Acid 29 - Tx count:", result2.transactions.length);

const result3 = getLedgerWithBalance(lid, "2026-04-01", "2027-03-31", undefined);
console.log("Global - Opening Balance:", result3.openingBalance);
console.log("Global - Tx count:", result3.transactions.length);

