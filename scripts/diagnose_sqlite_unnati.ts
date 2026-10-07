import Database from 'better-sqlite3';

const db = new Database('C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db', { readonly: true });

const acid = 29;
const endDate = '2026-03-31';

// 1. Get portfolios for Unnati
const pflinks = db.prepare('SELECT * FROM ACC_PFLINK WHERE ACID = ?').all(acid);
const pfids = pflinks.map((p: any) => p.PFID);
console.log('Unnati (ACID 29) Portfolio IDs:', pfids);

// 2. Get ACMA1 for Unnati (or all ACMA)
const acmaRows = db.prepare('SELECT * FROM ACMA1 WHERE ACID = ?').all(acid);
console.log('ACMA rows for Unnati:', acmaRows.length);

const trans1 = db.prepare('SELECT * FROM Trans1 WHERE ACID = ?').all(acid);
console.log('Trans1 rows for Unnati (ACID 29):', trans1.length);

const v1 = db.prepare('SELECT * FROM Vouchers1 WHERE ACID = ?').all(acid);
console.log('Vouchers1 rows for Unnati (ACID 29):', v1.length);

// Check BS1 (trade transactions) for Unnati's portfolios
const bs1 = db.prepare('SELECT * FROM BS1 WHERE PFID IN (' + pfids.join(',') + ')').all();
console.log('BS1 rows for Unnati:', bs1.length);

// Check SumTable for Unnati's portfolios
const sumTable = db.prepare('SELECT * FROM SumTable WHERE PFolioID IN (' + pfids.join(',') + ')').all();
console.log('SumTable rows for Unnati:', sumTable.length);

// Sum up holding values in SumTable for Unnati
let totalAmtInv = 0;
let totalCurrV = 0;
sumTable.forEach((s: any) => {
  const qnt = Number(s.QNT || s.qnt || 0);
  const currv = Number(s.CURRV || s.currv || 0);
  const amtinv = Number(s.AMTINV || s.amtinv || 0);
  if (qnt > 0.0001 || currv > 0.01) {
    totalAmtInv += amtinv;
    totalCurrV += currv;
  }
});
console.log(`SumTable Active Holdings: Invested=₹${totalAmtInv.toFixed(2)}, Current=₹${totalCurrV.toFixed(2)}`);

// Let's check the ledger balances in ACMA1 for Unnati
console.log('\n--- ACMA1 LEDGERS FOR UNNATI (ACID 29) ---');
let totalCr = 0;
let totalDb = 0;
acmaRows.forEach((a: any) => {
  const cr = Number(a.CR_BAL) || 0;
  const db_ = Number(a.DB_BAL) || 0;
  totalCr += cr;
  totalDb += db_;
  if (cr > 0 || db_ > 0) {
    console.log(`ID ${a.ID} | Parent ${a.PARENT_ID} | ${a.NAME} | Dr: ${db_.toFixed(2)} | Cr: ${cr.toFixed(2)} | Net: ${(db_ - cr).toFixed(2)}`);
  }
});

console.log(`Total DB_BAL: ₹${totalDb.toFixed(2)}, Total CR_BAL: ₹${totalCr.toFixed(2)}, Difference: ₹${(totalDb - totalCr).toFixed(2)}`);
