import fs from 'fs';
import path from 'path';

const dbPath = path.resolve('db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// 1. Ensure 'Dividend Income' group exists
if (!db.groups.find((g: any) => g.id === 'dividend_income')) {
  db.groups.push({
    id: 'dividend_income',
    name: 'Dividend Income',
    parent: 'income',
    type: 'INCOME'
  });
}

// 2. Ensure 'Dividend Income' ledger exists
let divLedger = db.ledgers.find((l: any) => l.name === 'Dividend Income');
if (!divLedger) {
  divLedger = {
    id: 'l_div_inc',
    name: 'Dividend Income',
    groupId: 'dividend_income',
    openingBalance: 0,
    openingType: 'CR'
  };
  db.ledgers.push(divLedger);
}

// 3. Update Voucher ota0lyu1u
const vId = 'ota0lyu1u';
const vEntries = db.entries.filter((e: any) => e.voucherId === vId);
const stockEntry = vEntries.find((e: any) => e.ledgerId === 'stk_hdfc' && e.credit === 2000);

if (stockEntry) {
  stockEntry.ledgerId = divLedger.id;
  console.log(`Updated voucher ${vId}: Moved credit from stk_hdfc to ${divLedger.id}`);
} else {
  console.log(`Could not find credit entry of 2000 in voucher ${vId}`);
}

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
console.log("Database updated successfully.");
