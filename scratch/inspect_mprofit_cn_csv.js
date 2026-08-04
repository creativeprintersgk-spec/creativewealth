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
  const t1 = await parseCSV('Trans1.csv');
  const tc1 = await parseCSV('TransC1.csv');
  const bs1 = await parseCSV('BS1.csv');
  const scnote = await parseCSV('SCNOTE1.csv');

  console.log("Loaded all CSV files.");

  // Let's find some scnote records
  console.log("Total SCNOTE rows:", scnote.length);
  // Find a sample CNID
  const sampleCn = scnote.find(r => r.CNNUM && r.CNNUM.length > 5);
  if (!sampleCn) {
    console.log("No sample CNNUM found.");
    return;
  }
  const cnid = sampleCn.CNID;
  console.log("Sample SCNOTE row:", sampleCn);

  // Find where this CNID is referenced in VouchersC1 or Vouchers1
  const vch = vc1.find(r => r.CNID === cnid) || v1.find(r => r.CNID === cnid);
  console.log("Voucher referencing CNID:", vch);

  if (vch) {
    const vid = vch.VID;
    // Find trans lines in TransC1 and Trans1
    const transLines = tc1.filter(r => r.VID === vid).concat(t1.filter(r => r.VID === vid));
    console.log(`Transactions for VID ${vid}:`, transLines);

    // Let's get names of MAID (we can map them to ACMA1)
    const acma = await parseCSV('ACMA1.csv');
    transLines.forEach(l => {
      const led = acma.find(a => a.ID === l.MAID);
      console.log(`   MAID=${l.MAID} (${led ? led.DESCR : 'unknown'}), DR=${l.DRAMT}, CR=${l.CRAMT}`);
    });

    // Find BS1 rows linked to this CNID
    const bsRows = bs1.filter(r => r.CNID === cnid);
    console.log(`BS1 rows for CNID ${cnid}:`, bsRows);
  } else {
    // Let's search by DT
    const date = sampleCn.DT.split(' ')[0]; // yyyy-mm-dd
    console.log(`No voucher directly matches CNID ${cnid}. Searching vouchers on date ${date}...`);
    const dateVouchers = vc1.filter(r => r.DT.startsWith(date)).concat(v1.filter(r => r.DT.startsWith(date)));
    console.log(`Vouchers on ${date}:`, dateVouchers);
  }
}

run().catch(console.error);
