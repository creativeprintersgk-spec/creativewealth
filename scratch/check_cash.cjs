const db = require('better-sqlite3')('C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db');
const l = db.prepare("SELECT ID, DB_BAL, CR_BAL, NAME FROM ACMAC1 WHERE NAME='Cash on Hand' AND IS_GROUP=0 LIMIT 1").get();
console.log(l);
console.log(db.prepare("SELECT SUM(DRAMT - CRAMT) as d FROM Trans1 WHERE MAID=?").get(l.ID).d);
console.log(db.prepare("SELECT SUM(DRAMT - CRAMT) as d FROM TransC1 WHERE MAID=?").get(l.ID).d);
