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
  const scnote = await parseCSV('SCNOTE1.csv');
  console.log("SCNOTE total rows:", scnote.length);

  const cn61 = scnote.find(r => r.CNID === '61');
  console.log("CNID=61 in SCNOTE1.csv:", cn61);

  const vc1 = await parseCSV('VouchersC1.csv');
  const cnidsInVc1 = new Set(vc1.map(r => r.CNID));
  console.log("Unique CNIDs in VouchersC1.csv:", Array.from(cnidsInVc1).slice(0, 10));

  // Let's check if any CNID in VouchersC1 is present in SCNOTE1.csv
  const commonCnids = scnote.filter(r => cnidsInVc1.has(r.CNID));
  console.log(`Number of CNIDs in SCNOTE1.csv that are also in VouchersC1.csv: ${commonCnids.length}`);
  if (commonCnids.length > 0) {
    console.log("Sample common CNIDs:", commonCnids.slice(0, 3));
    
    // Find the voucher and transaction lines for the first common CNID
    const sampleCnid = commonCnids[0].CNID;
    const vch = vc1.find(r => r.CNID === sampleCnid);
    console.log("Voucher in VC1 for CNID", sampleCnid, ":", vch);

    const tc1 = await parseCSV('TransC1.csv');
    const trans = tc1.filter(r => r.VID === vch.VID);
    console.log("Trans lines in TC1 for VID", vch.VID, ":");
    
    const acma = await parseCSV('ACMA1.csv');
    trans.forEach(t => {
      const led = acma.find(a => a.ID === t.MAID);
      console.log(`   MAID=${t.MAID} (${led ? led.DESCR : 'unknown'}), DR=${t.DRAMT}, CR=${t.CRAMT}`);
    });
  }
}

run().catch(console.error);
