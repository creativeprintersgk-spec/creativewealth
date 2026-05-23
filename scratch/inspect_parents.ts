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
  const parentMap = new Map<string, string[]>();
  
  for (const row of acma) {
    const parentId = row.PARENT_ID;
    if (!parentMap.has(parentId)) parentMap.set(parentId, []);
    parentMap.get(parentId)!.push(row.NAME);
  }
  
  console.log("Unique PARENT_ID values and sample ledgers under them:");
  for (const [parent, names] of parentMap.entries()) {
    console.log(`\nParent Group ID: ${parent}`);
    console.log(`Count: ${names.length}`);
    console.log(`Sample Names:`, names.slice(0, 10));
  }
}

run();
