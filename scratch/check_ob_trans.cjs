const db = require('better-sqlite3')('C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db');
const ledgers = db.prepare('SELECT ID, DB_BAL, CR_BAL, ACID, NAME FROM ACMAC1 WHERE IS_GROUP=0').all();
let diffs = 0;
ledgers.forEach(l => {
  let ob = l.DB_BAL - l.CR_BAL;
  let t = db.prepare("SELECT SUM(DRAMT - CRAMT) as d FROM Trans1 WHERE MAID=? AND ACID=? AND DT='0001-01-01 00:00:00'").get(l.ID, l.ACID).d || 0;
  if(Math.abs(ob - t) > 0.01) { diffs++; }
});
console.log('Ledgers where DB_BAL != 0001-01-01 Trans:', diffs);
