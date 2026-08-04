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
  const v1 = await parseCSV('Vouchers1.csv');
  const vc1 = await parseCSV('VouchersC1.csv');

  const v1WithPf = v1.filter(r => r.PFID && r.PFID.trim() !== '');
  const v1WithoutPf = v1.filter(r => !r.PFID || r.PFID.trim() === '');

  const vc1WithPf = vc1.filter(r => r.PFID && r.PFID.trim() !== '');
  const vc1WithoutPf = vc1.filter(r => !r.PFID || r.PFID.trim() === '');

  console.log("=== V1 (Trading Vouchers) PFID status ===");
  console.log(`  With PFID:    ${v1WithPf.length}`);
  console.log(`  Without PFID: ${v1WithoutPf.length}`);

  console.log("=== VC1 (Capital Vouchers) PFID status ===");
  console.log(`  With PFID:    ${vc1WithPf.length}`);
  console.log(`  Without PFID: ${vc1WithoutPf.length}`);

  if (v1WithPf.length > 0) {
    console.log("Sample V1 with PFID:", v1WithPf.slice(0, 3));
  }
  if (vc1WithoutPf.length > 0) {
    console.log("Sample VC1 without PFID:", vc1WithoutPf.slice(0, 3));
  }
}

run().catch(console.error);
