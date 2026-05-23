import * as fs from 'fs';
import * as path from 'path';
import csvParser from 'csv-parser';

const CSV_DIR = path.join(process.cwd(), 'scratch', 'mprofit_csv');

function parseCSV(fileName: string): Promise<any[]> {
  return new Promise((resolve) => {
    const rows: any[] = [];
    fs.createReadStream(path.join(CSV_DIR, fileName))
      .pipe(csvParser({ mapHeaders: ({ header }) => header.trim().replace(/^\uFEFF/, '') }))
      .on('data', d => rows.push(d))
      .on('end', () => resolve(rows));
  });
}

async function debug() {
  const trans = await parseCSV('Trans1.csv');
  const ledgers = await parseCSV('ACMA1.csv');
  
  const targetMaid = '30'; // Pramesh Shah capital ledger under Saahil Shah (ACID 31)
  const targetTrans = trans.filter(t => t.MAID === targetMaid);
  
  console.log(`Found ${targetTrans.length} transactions for MAID = ${targetMaid} in Trans1.csv`);
  
  // Let's look at the first 10 transactions
  console.log('First 10 transactions:');
  console.log(targetTrans.slice(0, 10).map(t => ({
    TRANSID: t.TRANSID,
    VID: t.VID,
    ACID: t.ACID,
    MAID: t.MAID,
    DRAMT: t.DRAMT,
    CRAMT: t.CRAMT,
    Narr: t.Narr
  })));
  
  // Let's calculate total debit and credit in Trans1.csv
  let dramt = 0;
  let cramt = 0;
  targetTrans.forEach(t => {
    dramt += parseFloat(t.DRAMT) || 0;
    cramt += parseFloat(t.CRAMT) || 0;
  });
  console.log(`Trans1.csv totals for MAID 30 - DR: ${dramt}, CR: ${cramt}, Net: ${cramt - dramt}`);
}

debug().catch(console.error);
