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
  const vouchers = await parseCSV('Vouchers1.csv');
  const saahilVouchers = vouchers.filter(v => v.ACID && v.ACID.trim() === '31');
  console.log(`Found ${saahilVouchers.length} vouchers for Saahil (ACID=31) in Vouchers1.csv`);
}

run().catch(console.error);
