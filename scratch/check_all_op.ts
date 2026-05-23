import fs from 'fs';
import csvParser from 'csv-parser';

function parseCSV(fileName: string): Promise<any[]> {
  return new Promise((resolve) => {
    const rows: any[] = [];
    fs.createReadStream('scratch/mprofit_csv/' + fileName)
      .pipe(csvParser({ mapHeaders: ({ header }) => header.trim().replace(/^\uFEFF/, '') }))
      .on('data', d => rows.push(d))
      .on('end', () => resolve(rows));
  });
}

async function run() {
  const trans = await parseCSV('Trans1.csv');
  const allOp = trans.filter(t => t.VID === '0');
  
  const acidSummary = new Map<string, { dr: number, cr: number }>();
  let totalDr = 0;
  let totalCr = 0;

  allOp.forEach(t => {
    const acid = t.ACID.trim();
    const dr = parseFloat(t.DRAMT) || 0;
    const cr = parseFloat(t.CRAMT) || 0;
    
    if (!acidSummary.has(acid)) {
      acidSummary.set(acid, { dr: 0, cr: 0 });
    }
    const item = acidSummary.get(acid)!;
    item.dr += dr;
    item.cr += cr;

    totalDr += dr;
    totalCr += cr;
  });

  console.log('--- Opening Balances Summary by ACID ---');
  for (const [acid, bal] of acidSummary.entries()) {
    console.log(`ACID: ${acid}, DR: ${bal.dr.toFixed(2)}, CR: ${bal.cr.toFixed(2)}, Diff: ${(bal.dr - bal.cr).toFixed(2)}`);
  }

  console.log(`\nGrand Total DR: ${totalDr.toFixed(2)}`);
  console.log(`Grand Total CR: ${totalCr.toFixed(2)}`);
  console.log(`Grand Total Diff: ${(totalDr - totalCr).toFixed(2)}`);
}

run();
