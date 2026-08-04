const db = require('better-sqlite3')('C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db');
const acid = 30;
const l = db.prepare("SELECT ID, DB_BAL, CR_BAL FROM ACMAC1 WHERE ACID=30 AND NAME='BOM' AND IS_GROUP=0").get();
console.log('OB:', l.DB_BAL - l.CR_BAL);
console.log('Trans1:', db.prepare('SELECT DRAMT, CRAMT, DT FROM Trans1 WHERE MAID=? AND ACID=30').all(l.ID));
console.log('TransC1:', db.prepare('SELECT DRAMT, CRAMT, DT FROM TransC1 WHERE MAID=? AND ACID=30').all(l.ID));
