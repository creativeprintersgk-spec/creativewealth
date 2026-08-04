const db = require('better-sqlite3')('C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db');
function checkUI() {
  const acid = 30;
  let totalDebit = 0;
  let totalCredit = 0;

  db.prepare('SELECT ID, DB_BAL, CR_BAL, NAME FROM ACMAC1 WHERE ACID=? AND IS_GROUP=0').all(acid).forEach(l => {
    let ob = l.DB_BAL - l.CR_BAL;
    let t = db.prepare("SELECT SUM(DRAMT - CRAMT) as d FROM TransC1 WHERE MAID=? AND ACID=? AND DT <= '2027-03-31 23:59:59'").get(l.ID, acid).d || 0;
    let t2 = db.prepare("SELECT SUM(DRAMT - CRAMT) as d FROM Trans1 WHERE MAID=? AND ACID=? AND DT <= '2027-03-31 23:59:59'").get(l.ID, acid).d || 0;
    let bal = ob + t + t2;
    if (Math.abs(bal) > 0.01) {
      if (bal > 0) totalDebit += bal;
      if (bal < 0) totalCredit += Math.abs(bal);
    }
  });

  console.log(`Pramesh Shah Ac (ID 30) UI: Debit ${totalDebit}, Credit ${totalCredit}, Diff ${Math.abs(totalDebit - totalCredit)}`);

  const acid2 = 32;
  totalDebit = 0;
  totalCredit = 0;
  db.prepare('SELECT ID, DB_BAL, CR_BAL, NAME FROM ACMAC1 WHERE ACID=? AND IS_GROUP=0').all(acid2).forEach(l => {
    let ob = l.DB_BAL - l.CR_BAL;
    let t = db.prepare("SELECT SUM(DRAMT - CRAMT) as d FROM TransC1 WHERE MAID=? AND ACID=? AND DT <= '2027-03-31 23:59:59'").get(l.ID, acid2).d || 0;
    let t2 = db.prepare("SELECT SUM(DRAMT - CRAMT) as d FROM Trans1 WHERE MAID=? AND ACID=? AND DT <= '2027-03-31 23:59:59'").get(l.ID, acid2).d || 0;
    let bal = ob + t + t2;
    if (Math.abs(bal) > 0.01) {
      if (bal > 0) totalDebit += bal;
      if (bal < 0) totalCredit += Math.abs(bal);
    }
  });

  console.log(`Pramesh HUF Ac (ID 32) UI: Debit ${totalDebit}, Credit ${totalCredit}, Diff ${Math.abs(totalDebit - totalCredit)}`);
}
checkUI();
