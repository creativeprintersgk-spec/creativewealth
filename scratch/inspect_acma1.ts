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
  const acma = await parseCSV('ACMA1.csv');
  console.log(`Total ACMA1 rows: ${acma.length}`);
  
  const groups = acma.filter(r => r.IS_GROUP === '1');
  const ledgers = acma.filter(r => r.IS_GROUP === '0');
  
  console.log(`Groups: ${groups.length}`);
  console.log(`Ledgers: ${ledgers.length}`);
  
  console.log("\nSample Groups:");
  console.log(groups.slice(0, 10).map(g => ({ ID: g.ID, NAME: g.NAME, PARENT_ID: g.PARENT_ID })));
  
  console.log("\nSample Ledgers:");
  console.log(ledgers.slice(0, 10).map(l => ({ ID: l.ID, NAME: l.NAME, PARENT_ID: l.PARENT_ID, ACID: l.ACID })));
}

run();
