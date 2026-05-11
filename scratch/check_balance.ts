import fs from 'fs';
import path from 'path';

const dbPath = path.resolve('db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const ledgers = db.ledgers;
const vouchers = db.vouchers;
const entries = db.entries;
const groups = db.groups;

const getGroupType = (groupId: string): string => {
  let current = groups.find((g: any) => g.id === groupId);
  while (current) {
    if (current.type) return current.type;
    current = groups.find((g: any) => g.id === current.parent);
  }
  return "ASSET";
};

const getLedgerBalance = (ledgerId: string): number => {
  const ledger = ledgers.find((l: any) => l.id === ledgerId);
  if (!ledger) return 0;

  let bal = 0;
  if (ledger.openingBalance) {
    if (ledger.openingType === 'DR') bal += ledger.openingBalance;
    else bal -= ledger.openingBalance;
  }

  entries.filter((e: any) => e.ledgerId === ledgerId).forEach((e: any) => {
    bal += e.debit || 0;
    bal -= e.credit || 0;
  });

  return bal;
};

let totalDr = 0;
let totalCr = 0;

ledgers.forEach((l: any) => {
  const bal = getLedgerBalance(l.id);
  if (bal > 0) totalDr += bal;
  else totalCr += Math.abs(bal);
});

console.log("Total Debit:", totalDr);
console.log("Total Credit:", totalCr);
console.log("Difference:", totalDr - totalCr);

// Check if specific voucher ota0lyu1u is balanced
const otaVoucher = vouchers.find((v: any) => v.id === 'ota0lyu1u');
if (otaVoucher) {
  const otaEntries = entries.filter((e: any) => e.voucherId === 'ota0lyu1u');
  const dr = otaEntries.reduce((s: any, e: any) => s + (e.debit || 0), 0);
  const cr = otaEntries.reduce((s: any, e: any) => s + (e.credit || 0), 0);
  console.log("Voucher ota0lyu1u: DR", dr, "CR", cr, "Balanced?", dr === cr);
}
