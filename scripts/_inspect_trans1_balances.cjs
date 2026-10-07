const Database = require("better-sqlite3");
const db = new Database("C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db", { readonly: true });

console.log("=== TRANSACTIONS FOR ACCOUNT 29 (UNNATI) IN Trans1 ===");
const t29 = db.prepare("SELECT * FROM Trans1 WHERE ACID=29").all();
console.log("Total Trans1 for Unnati (ACID=29):", t29.length);

let totalDr = 0;
let totalCr = 0;
const maidMap = {};

for (const t of t29) {
  totalDr += t.DRAMT || 0;
  totalCr += t.CRAMT || 0;
  if (!maidMap[t.MAID]) maidMap[t.MAID] = { dr: 0, cr: 0 };
  maidMap[t.MAID].dr += t.DRAMT || 0;
  maidMap[t.MAID].cr += t.CRAMT || 0;
}

console.log(`Grand Total in Trans1: DR = ${totalDr.toFixed(2)}, CR = ${totalCr.toFixed(2)}, Net = ${(totalDr - totalCr).toFixed(2)}`);

// Check HDFC Bank in Trans1
const hdfc = maidMap[11];
console.log("HDFC Bank (MAID 11) in Trans1:", hdfc);

// Check if there are other transactions for HDFC Bank across ALL accounts in Trans1
const hdfcAll = db.prepare("SELECT ACID, sum(DRAMT) as dr, sum(CRAMT) as cr FROM Trans1 WHERE MAID=11 GROUP BY ACID").all();
console.log("HDFC Bank (MAID 11) across all ACIDs in Trans1:", hdfcAll);
