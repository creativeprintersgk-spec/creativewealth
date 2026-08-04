const db = require('better-sqlite3')('C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db');

const transc1 = db.prepare('SELECT * FROM TransC1').all().map(r => ({
  id: r.TRANSID, maid: r.MAID, acid: r.ACID, dt: r.DT, dramt: r.DRAMT, cramt: r.CRAMT
}));
const trans1 = db.prepare('SELECT * FROM Trans1').all().map(r => ({
  id: r.TRANSID, maid: r.MAID, acid: r.ACID, dt: r.DT, dramt: r.DRAMT, cramt: r.CRAMT
}));
const acmac1 = db.prepare('SELECT * FROM ACMAC1').all().map(r => ({
  id: r.ID, acid: r.ACID, name: r.NAME, db_bal: r.DB_BAL, cr_bal: r.CR_BAL, is_group: r.IS_GROUP
}));

const transC1ByMaid = new Map();
transc1.forEach(t => {
  let list = transC1ByMaid.get(t.maid);
  if (!list) { list = []; transC1ByMaid.set(t.maid, list); }
  list.push(t);
});

const trans1ByMaid = new Map();
trans1.forEach(t => {
  let list = trans1ByMaid.get(t.maid);
  if (!list) { list = []; trans1ByMaid.set(t.maid, list); }
  list.push(t);
});

const acmac1Map = new Map();
acmac1.forEach(a => {
  let list = acmac1Map.get(a.id);
  if (!list) { list = []; acmac1Map.set(a.id, list); }
  list.push(a);
});

function getLedgerBalance(ledgerId, acidNum) {
  const lid = Number(ledgerId);
  const rawC1 = transC1ByMaid.get(lid) || [];
  const c1Entries = rawC1.filter(e => !acidNum || e.acid === acidNum);

  const raw1 = trans1ByMaid.get(lid) || [];
  const t1Entries = raw1.filter(e => !acidNum || e.acid === acidNum);

  let entries = [...c1Entries, ...t1Entries].sort((a, b) => (a.dt || '').localeCompare(b.dt || ''));

  let openingBalance = 0, runningBalance = 0;
  const ledgerList = acmac1Map.get(lid) || [];
  const ledgerObj = ledgerList.find(a => !acidNum || a.acid === acidNum) || ledgerList[0];
  if (ledgerObj) {
    const obCr = Number(ledgerObj.cr_bal) || 0;
    const obDb = Number(ledgerObj.db_bal) || 0;
    openingBalance = obDb - obCr;
    runningBalance = openingBalance;
  }

  const endDate = '2027-03-31';

  entries.forEach(e => {
    const dr = Number(e.dramt) || 0;
    const cr = Number(e.cramt) || 0;
    const inRange = (!endDate || (e.dt || '').split(' ')[0] <= endDate);
    if (inRange) {
      runningBalance += (dr - cr);
    }
  });

  return runningBalance;
}

function getTrialBalance(acidNum) {
  const ledgers = acmac1.filter(a => !a.is_group && (!acidNum || a.acid === acidNum));
  let totalDebit = 0;
  let totalCredit = 0;
  
  ledgers.forEach(l => {
    const bal = getLedgerBalance(l.id, acidNum);
    if (Math.abs(bal) >= 0.001) {
      if (bal > 0) totalDebit += bal;
      if (bal < 0) totalCredit += Math.abs(bal);
    }
  });

  console.log(`ACID ${acidNum} -> Debit: ${totalDebit}, Credit: ${totalCredit}, Diff: ${Math.abs(totalDebit - totalCredit)}`);
}

getTrialBalance(30);
getTrialBalance(32);
