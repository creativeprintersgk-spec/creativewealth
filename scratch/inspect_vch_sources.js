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
  const portfolios = await parseCSV('Portfolios.csv');

  const v1Acids = new Set(v1.map(r => r.ACID).filter(Boolean));
  const vc1Acids = new Set(vc1.map(r => r.ACID).filter(Boolean));

  console.log("=== V1 (Trading Vouchers) Account IDs ===");
  v1Acids.forEach(acid => {
    const port = portfolios.find(p => p.ID === acid);
    console.log(`  ACID=${acid}: name="${port ? port.INVESTORNAME || port.FULLNAME : 'unknown'}" type=${port ? port.PFOLIOTYPE : 'unknown'}`);
  });

  console.log("=== VC1 (Capital Vouchers) Account IDs ===");
  vc1Acids.forEach(acid => {
    const port = portfolios.find(p => p.ID === acid);
    console.log(`  ACID=${acid}: name="${port ? port.INVESTORNAME || port.FULLNAME : 'unknown'}" type=${port ? port.PFOLIOTYPE : 'unknown'}`);
  });
}

run().catch(console.error);
