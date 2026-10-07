import fs from 'fs';
const snapshotDir = 'backups/latest_snapshot';
const acmac1 = JSON.parse(fs.readFileSync(`${snapshotDir}/acmac1.json`, 'utf8'));
const accPflink = JSON.parse(fs.readFileSync(`${snapshotDir}/acc_pflink.json`, 'utf8'));
const transC1 = JSON.parse(fs.readFileSync(`${snapshotDir}/transc1.json`, 'utf8'));
const sumTable = JSON.parse(fs.readFileSync(`${snapshotDir}/sum_table.json`, 'utf8'));
const portfolios = JSON.parse(fs.readFileSync(`${snapshotDir}/portfolios.json`, 'utf8'));

const NON_UNITIZED_GROUPS: Record<number, number> = {
  200120: 130, // PPF/EPF
  200095: 90,  // Fixed Deposits
  200070: 110, // NCD / Debentures
  200115: 120, // Deposits / Loans
  200135: 140, // Post Office
  200150: 160, // Properties
  200155: 170, // Jewellery
  200145: 180, // Art
  200066: 190, // Private Equity
  200160: 210, // AIF
  200195: 220, // Loans
};

// Test for Krisha (pfid: 40)
const pfid = 40;
const link = accPflink.find((l: any) => l.pfid === pfid);
console.log('Portfolio 40 linked acid:', link?.acid);

const ledgers = acmac1.filter((a: any) => a.acid === link?.acid && NON_UNITIZED_GROUPS[Number(a.parent_id)]);
console.log('Found non-unitized ledgers for acid:', ledgers.length);

ledgers.forEach((l: any) => {
  const opNet = (Number(l.db_bal) || 0) - (Number(l.cr_bal) || 0);
  const txs = transC1.filter((t: any) => t.maid === l.id && t.acid === l.acid);
  const txNet = txs.reduce((sum: number, t: any) => sum + (Number(t.dramt) || 0) - (Number(t.cramt) || 0), 0);
  const total = opNet + txNet;
  console.log(`  id=${l.id} name="${l.name}" parent=${l.parent_id} atty=${NON_UNITIZED_GROUPS[l.parent_id]} opNet=${opNet} txNet=${txNet} total=${total}`);
});
