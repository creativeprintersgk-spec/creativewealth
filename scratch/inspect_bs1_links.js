import fs from 'fs';
import path from 'path';
import csvParser from 'csv-parser';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CSV_DIR = path.join(__dirname, 'mprofit_csv');

function parseCSV(fileName) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const filePath = path.join(CSV_DIR, fileName);
    if (!fs.existsSync(filePath)) { resolve([]); return; }
    fs.createReadStream(filePath)
      .pipe(csvParser({ mapHeaders: ({ header }) => header.trim().toUpperCase() }))
      .on('data', (d) => rows.push(d))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

async function run() {
  const bs1 = await parseCSV('BS1.csv');
  console.log("BS1 rows:", bs1.length);

  const bs963 = bs1.filter(r => r.ACVCH === '963' || r.CNID === '4157');
  console.log("BS1 rows matching ACVCH=963 or CNID=4157:", bs963);

  // Let's count how many BS1 rows have ACVCH not empty and not -1
  const bsWithAcvch = bs1.filter(r => r.ACVCH && r.ACVCH !== '-1' && r.ACVCH !== '');
  console.log("BS1 rows with ACVCH:", bsWithAcvch.length);
  if (bsWithAcvch.length > 0) {
    console.log("Sample BS1 rows with ACVCH:", bsWithAcvch.slice(0, 5));
  }

  // Let's count how many BS1 rows have CNID not empty and not -1
  const bsWithCnid = bs1.filter(r => r.CNID && r.CNID !== '-1' && r.CNID !== '');
  console.log("BS1 rows with CNID:", bsWithCnid.length);
  if (bsWithCnid.length > 0) {
    console.log("Sample BS1 rows with CNID:", bsWithCnid.slice(0, 5));
  }
}

run().catch(console.error);
