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
  const acma = await parseCSV('ACMA1.csv');
  const groups = acma.filter(r => r.IsItLedger === '0' || r.IS_GROUP === '1');
  console.log(`Groups in ACMA1 (${groups.length}):`);
  console.log(groups.map(g => ({ ID: g.ID, NAME: g.NAME, PARENT_ID: g.PARENT_ID, IsItLedger: g.IsItLedger, IS_GROUP: g.IS_GROUP })));
}

debug().catch(console.error);
