import * as fs from 'fs';
import * as path from 'path';
import csvParser from 'csv-parser';

const CSV_DIR = path.join(process.cwd(), 'scratch', 'mprofit_csv');

async function parseCSV(fileName: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    const filePath = path.join(CSV_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      resolve([]);
      return;
    }
    fs.createReadStream(filePath)
      .pipe(csvParser({
        mapHeaders: ({ header }) => header.trim().replace(/^\uFEFF/, '')
      }))
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
}

async function run() {
  const trans = await parseCSV('Trans1.csv');
  const acma = await parseCSV('ACMA1.csv');
  
  const acmaIds = new Set(acma.map(a => a.ID));
  console.log(`Loaded ${trans.length} transactions and ${acma.length} ACMA ledgers.`);
  
  const missingLedgers = new Map<string, any>();
  for (const t of trans) {
    const key = `${t.MAID}_${t.EXTID}`;
    if (!acmaIds.has(t.MAID)) {
      missingLedgers.set(t.MAID, { MAID: t.MAID, EXTID: t.EXTID, SpecialAccount: t.SpecialAccount });
    }
  }
  
  console.log(`Transactions have ${missingLedgers.size} ledger IDs missing from ACMA1.csv.`);
  console.log("Sample missing ledgers:", Array.from(missingLedgers.values()).slice(0, 20));
}

run();
