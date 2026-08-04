const db = require('better-sqlite3')('C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db');
const acid = 30;
const l = db.prepare("SELECT ID, DB_BAL, CR_BAL FROM ACMAC1 WHERE ACID=30 AND ID=48 AND IS_GROUP=0").get();
console.log('OB:', l.DB_BAL - l.CR_BAL);
let t = db.prepare("SELECT SUM(DRAMT - CRAMT) as d FROM Trans1 WHERE MAID=? AND ACID=30").get(l.ID).d||0;
let tC = db.prepare("SELECT SUM(DRAMT - CRAMT) as d FROM TransC1 WHERE MAID=? AND ACID=30").get(l.ID).d||0;
console.log('Trans1 sum:', t);
console.log('TransC1 sum:', tC);
