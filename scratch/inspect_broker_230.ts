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
  const t230 = trans.filter(t => t.MAID === '230');
  
  const extids = new Set(t230.map(t => t.EXTID));
  console.log('EXTID values for MAID = 230:', Array.from(extids));
  
  console.log('First 5 transactions for MAID 230:');
  console.log(t230.slice(0, 5).map(t => ({
    VID: t.VID,
    DRAMT: t.DRAMT,
    CRAMT: t.CRAMT,
    EXTID: t.EXTID,
    Narr: t.Narr
  })));
  
  // Let's also check if there are other MAIDs that are not in ACMA1.csv and what their EXTIDs are
  const acma = await parseCSV('ACMA1.csv');
  const acmaIds = new Set(acma.map(a => a.ID));
  
  const unknownMaids = new Set<string>();
  for (const t of trans) {
    if (!acmaIds.has(t.MAID)) {
      unknownMaids.add(t.MAID);
    }
  }
  
  console.log(`\nFound ${unknownMaids.size} unknown MAIDs in Trans1.csv`);
  console.log('Sample unknown MAIDs:', Array.from(unknownMaids).slice(0, 10));
}

debug().catch(console.error);
