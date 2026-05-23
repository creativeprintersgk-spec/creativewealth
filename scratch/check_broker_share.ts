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
  const broker230 = trans.filter(t => t.MAID === '230' && t.EXTID === '-5');
  
  console.log(`Total transactions for Broker 230: ${broker230.length}`);

  const acidMap = new Map<string, { dr: number, cr: number, count: number }>();
  broker230.forEach(t => {
    const acid = t.ACID.trim();
    const dr = parseFloat(t.DRAMT) || 0;
    const cr = parseFloat(t.CRAMT) || 0;

    if (!acidMap.has(acid)) {
      acidMap.set(acid, { dr: 0, cr: 0, count: 0 });
    }
    const item = acidMap.get(acid)!;
    item.dr += dr;
    item.cr += cr;
    item.count += 1;
  });

  console.log('\n--- Broker 230 Summary by ACID ---');
  for (const [acid, info] of acidMap.entries()) {
    console.log(`ACID: ${acid}, Count: ${info.count}, DR: ${info.dr.toFixed(2)}, CR: ${info.cr.toFixed(2)}, Net: ${(info.dr - info.cr).toFixed(2)}`);
  }
}

run();
