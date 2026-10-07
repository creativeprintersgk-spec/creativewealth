const Database = require("better-sqlite3");
const db = new Database("C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db", { readonly: true });

console.log("=== RKSV in SQLite ===");
// check ACMA1
const acma = db.prepare("SELECT * FROM ACMA1 WHERE ID=100002 OR NAME LIKE '%RKSV%'").all();
console.log("ACMA1:", acma);

// check Trans1
const t1 = db.prepare("SELECT COUNT(*) as count, SUM(DRAMT) as dr, SUM(CRAMT) as cr FROM Trans1 WHERE MAID=100002").all();
console.log("Trans1 MAID=100002:", t1);

// check Trans1 by ACID
const t1_acid = db.prepare("SELECT ACID, COUNT(*) as count, SUM(DRAMT) as dr, SUM(CRAMT) as cr FROM Trans1 WHERE MAID=100002 GROUP BY ACID").all();
console.log("Trans1 MAID=100002 by ACID:", t1_acid);

// check TransC1 or TransC2
try {
  const tc2 = db.prepare("SELECT COUNT(*) as count, SUM(DRAMT) as dr, SUM(CRAMT) as cr FROM TransC2 WHERE MAID=100002").all();
  console.log("TransC2 MAID=100002:", tc2);
} catch(e) { console.log("TransC2 err:", e.message); }

// check Mappings or Portfolios or SCNOTE1
const scnote = db.prepare("SELECT COUNT(*) as count, SUM(AMTDUE) as due FROM SCNOTE1 WHERE BRKRID=100002 OR BRKRID=2").all();
console.log("SCNOTE1:", scnote);
