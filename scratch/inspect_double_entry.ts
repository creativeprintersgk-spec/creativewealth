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
  
  const vids = ['347', '348', '349'];
  const vidTrans = trans.filter(t => vids.includes(t.VID));
  
  console.log(`Transactions for VIDs ${vids.join(', ')}:`);
  console.log(vidTrans.map(t => {
    const ledger = ledgers.find(l => l.ID === t.MAID);
    return {
      VID: t.VID,
      MAID: t.MAID,
      LedgerName: ledger ? ledger.NAME : `MAID ${t.MAID}`,
      DRAMT: t.DRAMT,
      CRAMT: t.CRAMT,
      EXTID: t.EXTID,
      Narr: t.Narr
    };
  }));
}

debug().catch(console.error);
