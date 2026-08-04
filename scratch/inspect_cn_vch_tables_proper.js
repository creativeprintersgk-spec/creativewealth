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

  console.log(`V1 Total rows: ${v1.length}`);
  console.log(`VC1 Total rows: ${vc1.length}`);

  const v1WithCN = v1.filter(r => r.CNID && r.CNID !== '-1' && r.CNID !== '');
  const vc1WithCN = vc1.filter(r => r.CNID && r.CNID !== '-1' && r.CNID !== '');

  console.log(`V1 with CNID != -1: ${v1WithCN.length}`);
  console.log(`VC1 with CNID != -1: ${vc1WithCN.length}`);

  const v1Vtyps = {};
  v1.forEach(r => { v1Vtyps[r.VTYP] = (v1Vtyps[r.VTYP] || 0) + 1; });
  const vc1Vtyps = {};
  vc1.forEach(r => { vc1Vtyps[r.VTYP] = (vc1Vtyps[r.VTYP] || 0) + 1; });
  console.log("V1 VTYP counts:", v1Vtyps);
  console.log("VC1 VTYP counts:", vc1Vtyps);
}

run().catch(console.error);
