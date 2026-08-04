import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseCsv(filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.split('\n');
  const headers = lines[0].trim().split(',');
  const cnidIdx = headers.indexOf('CNID');
  const vidIdx = headers.indexOf('VID');
  const narrIdx = headers.indexOf('NARR');
  const pfidIdx = headers.indexOf('PFID');
  
  let countWithCN = 0;
  let total = 0;
  const samples = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    total++;
    const parts = lines[i].split(',');
    const cnid = parts[cnidIdx];
    if (cnid && cnid !== '-1' && cnid !== '') {
      countWithCN++;
      if (samples.length < 5) {
        samples.push({
          vid: parts[vidIdx],
          cnid: cnid,
          narr: parts[narrIdx],
          pfid: parts[pfidIdx]
        });
      }
    }
  }
  return { total, countWithCN, samples };
}

const vch1Path = path.join(__dirname, 'mprofit_csv', 'Vouchers1.csv');
const vchC1Path = path.join(__dirname, 'mprofit_csv', 'VouchersC1.csv');

console.log("=== Vouchers1.csv ===");
try {
  console.log(parseCsv(vch1Path));
} catch (e) {
  console.error(e);
}

console.log("=== VouchersC1.csv ===");
try {
  console.log(parseCsv(vchC1Path));
} catch (e) {
  console.error(e);
}
