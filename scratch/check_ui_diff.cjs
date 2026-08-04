const db = require('better-sqlite3')('C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db');
function checkAcid(acid) {
  let tot = 0;
  db.prepare('SELECT ID, DB_BAL, CR_BAL FROM ACMAC1 WHERE ACID=? AND IS_GROUP=0').all(acid).forEach(l => {
    let ob = l.DB_BAL - l.CR_BAL;
    let t = db.prepare("SELECT SUM(DRAMT - CRAMT) as d FROM TransC1 WHERE MAID=? AND ACID=? AND DT <= '2027-03-31 23:59:59'").get(l.ID, acid).d || 0;
    let t2 = db.prepare("SELECT SUM(DRAMT - CRAMT) as d FROM Trans1 WHERE MAID=? AND ACID=? AND DT <= '2027-03-31 23:59:59'").get(l.ID, acid).d || 0;
    tot += ob + t + t2;
  });
  console.log(`UI Difference for acid ${acid}:`, tot);
}
checkAcid(30);
checkAcid(32);
