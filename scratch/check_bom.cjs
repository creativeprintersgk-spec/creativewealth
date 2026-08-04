const db = require('better-sqlite3')('C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db');
const l = db.prepare("SELECT ID, DB_BAL, CR_BAL, NAME FROM ACMAC1 WHERE ACID=30 AND NAME='BOM' AND IS_GROUP=0").get();
let ob = l.DB_BAL - l.CR_BAL;
let t = db.prepare("SELECT SUM(DRAMT - CRAMT) as d FROM TransC1 WHERE MAID=? AND ACID=30 AND DT <= '2027-03-31 23:59:59'").get(l.ID).d || 0;
let t2 = db.prepare("SELECT SUM(DRAMT - CRAMT) as d FROM Trans1 WHERE MAID=? AND ACID=30 AND DT <= '2027-03-31 23:59:59'").get(l.ID).d || 0;
console.log('BOM Balance:', ob + t + t2);
