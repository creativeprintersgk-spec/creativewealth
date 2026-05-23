import fs from 'fs';
import csvParser from 'csv-parser';

function parseCSV(fileName: string): Promise<any[]> {
  return new Promise((resolve) => {
    const rows: any[] = [];
    fs.createReadStream('scratch/mprofit_csv/' + fileName)
      .pipe(csvParser({ mapHeaders: ({ header }) => header.trim().replace(/^\uFEFF/, '') }))
      .on('data', d => rows.push(d))
      .on('end', () => resolve(rows));
  });
}

async function run() {
  const trans = await parseCSV('Trans1.csv');
  const matches = trans.filter(t => (t.VID === '0' || Number(t.VID) === 0));
  console.log(`Found ${matches.length} matching VID=0 transactions in Trans1.csv`);
  // Group by MAID
  const byMaid: Record<string, number> = {};
  matches.forEach(m => {
    byMaid[m.MAID] = (byMaid[m.MAID] || 0) + 1;
  });
  console.log('VID=0 transactions grouped by MAID:', byMaid);
}

run().catch(console.error);
