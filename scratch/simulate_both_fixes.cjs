const db = require('better-sqlite3')('C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db');

const transc1 = db.prepare('SELECT * FROM TransC1').all().map(r => ({
  id: r.TRANSID, maid: r.MAID, acid: r.ACID, dt: r.DT, dramt: r.DRAMT, cramt: r.CRAMT, vid: r.VID
}));
const trans1 = db.prepare('SELECT * FROM Trans1').all().map(r => ({
  id: r.TRANSID, maid: r.MAID, acid: r.ACID, dt: r.DT, dramt: r.DRAMT, cramt: r.CRAMT, vid: r.VID
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

function getLedgerBalance(ledgerId, acidNum, endDate) {
  const lid = Number(ledgerId);
  
  // FIX 1: Skip VID=0 entries (OB already in ACMAC1)
  const rawC1 = transC1ByMaid.get(lid) || [];
  const c1Entries = rawC1.filter(e => (!acidNum || e.acid === acidNum) && e.vid !== 0);
  const raw1 = trans1ByMaid.get(lid) || [];
  const t1Entries = raw1.filter(e => (!acidNum || e.acid === acidNum) && e.vid !== 0);
  let entries = [...c1Entries, ...t1Entries].sort((a, b) => (a.dt || '').localeCompare(b.dt || ''));

  let openingBalance = 0, runningBalance = 0;
  const ledgerList = acmac1Map.get(lid) || [];
  // FIX 2: Prefer non-group rows (is_group=false) to avoid 0-balance group rows
  const ledgerObj = ledgerList.find(a => !a.is_group && (!acidNum || a.acid === acidNum))
    || ledgerList.find(a => !acidNum || a.acid === acidNum)
    || ledgerList[0];
  if (ledgerObj) {
    const obCr = Number(ledgerObj.cr_bal) || 0;
    const obDb = Number(ledgerObj.db_bal) || 0;
    openingBalance = obDb - obCr;
    runningBalance = openingBalance;
  }

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

function getTrialBalance(acidNum, label) {
  const ledgers = acmac1.filter(a => !a.is_group && (!acidNum || a.acid === acidNum));
  let totalDebit = 0;
  let totalCredit = 0;
  
  ledgers.forEach(l => {
    const bal = getLedgerBalance(l.id, acidNum, '2027-03-31');
    if (Math.abs(bal) >= 0.001) {
      if (bal > 0) totalDebit += bal;
      if (bal < 0) totalCredit += Math.abs(bal);
    }
  });

  const diff = Math.abs(totalDebit - totalCredit);
  const balanced = diff < 0.01;
  console.log(`${label} (ACID ${acidNum}) -> Debit: ${totalDebit.toFixed(2)}, Credit: ${totalCredit.toFixed(2)}, Diff: ${diff.toFixed(2)} ${balanced ? '✅ BALANCED' : '❌ IMBALANCED'}`);
}

console.log('--- Trial Balance Simulation (with both fixes) ---');
getTrialBalance(29, 'Pramesh Shah (Individual)');
getTrialBalance(30, 'Pramesh Shah Ac');
getTrialBalance(31, 'Pramesh Shah (Joint)');
getTrialBalance(32, 'Pramesh HUF');
getTrialBalance(36, 'Pramesh Shah (PF)');
