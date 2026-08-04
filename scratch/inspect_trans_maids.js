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

  console.log(`Trans1 rows: ${t1.length}, TransC1 rows: ${tc1.length}`);

  // Group by MAID
  const t1Maids = {};
  t1.forEach(r => { t1Maids[r.MAID] = (t1Maids[r.MAID] || 0) + 1; });
  const tc1Maids = {};
  tc1.forEach(r => { tc1Maids[r.MAID] = (tc1Maids[r.MAID] || 0) + 1; });

  // Print MAIDs and their parent groups
  console.log("=== Trans1.csv MAID counts (top 15) ===");
  const sortedT1 = Object.entries(t1Maids).sort((a,b) => b[1] - a[1]).slice(0, 15);
  sortedT1.forEach(([maid, count]) => {
    const led = acma.find(a => a.ID === maid);
    console.log(`  MAID=${maid} count=${count} name="${led ? led.DESCR : 'unknown'}" parent=${led ? led.PARENT_ID : 'unknown'}`);
  });

  console.log("=== TransC1.csv MAID counts (top 15) ===");
  const sortedTc1 = Object.entries(tc1Maids).sort((a,b) => b[1] - a[1]).slice(0, 15);
  sortedTc1.forEach(([maid, count]) => {
    const led = acma.find(a => a.ID === maid);
    console.log(`  MAID=${maid} count=${count} name="${led ? led.DESCR : 'unknown'}" parent=${led ? led.PARENT_ID : 'unknown'}`);
  });
}

run().catch(console.error);
