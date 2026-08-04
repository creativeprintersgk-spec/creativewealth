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
  const t1 = await parseCSV('Trans1.csv');
  const tc1 = await parseCSV('TransC1.csv');
  const acma = await parseCSV('ACMA1.csv');

  // Let's identify which MAIDs in acma correspond to stocks (parent_id = 50 or 200050 etc.)
  const stockGroupIds = ['50', '200050', '200051', '200061', '200062'];
  const stockLedgerIds = new Set(
    acma.filter(a => stockGroupIds.includes(a.PARENT_ID) || Number(a.ID) >= 500000).map(a => a.ID)
  );

  console.log("Number of stock ledgers in ACMA1:", stockLedgerIds.size);

  const t1StockRows = t1.filter(r => stockLedgerIds.has(r.MAID) || Number(r.MAID) >= 500000);
  const tc1StockRows = tc1.filter(r => stockLedgerIds.has(r.MAID) || Number(r.MAID) >= 500000);

  console.log(`Stock-related rows in Trans1 (Trading): ${t1StockRows.length}`);
  console.log(`Stock-related rows in TransC1 (Capital): ${tc1StockRows.length}`);

  if (t1StockRows.length > 0) {
    console.log("Sample Trans1 stock row:", t1StockRows[0]);
  }
  if (tc1StockRows.length > 0) {
    console.log("Sample TransC1 stock row:", tc1StockRows[0]);
  }
}

run().catch(console.error);
