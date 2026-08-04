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
  const vc1 = await parseCSV('VouchersC1.csv');
  const tc1 = await parseCSV('TransC1.csv');

  const v963 = vc1.find(r => r.VID === '963');
  console.log("Voucher 963 in VouchersC1.csv:", v963);

  const t963 = tc1.filter(r => r.VID === '963');
  console.log("Trans 963 in TransC1.csv:", t963);
}

run().catch(console.error);
