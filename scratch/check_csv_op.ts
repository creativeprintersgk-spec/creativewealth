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
  const unnatiOp = trans.filter(t => t.VID === '0' && t.ACID.trim() === '29');
  
  let drSum = 0;
  let crSum = 0;
  console.log('--- Raw opening entries in Trans1.csv for ACID = 29 ---');
  unnatiOp.forEach(t => {
    const dr = parseFloat(t.DRAMT) || 0;
    const cr = parseFloat(t.CRAMT) || 0;
    if (dr > 0 || cr > 0) {
      console.log(`MAID: ${t.MAID}, EXTID: ${t.EXTID}, DR: ${dr}, CR: ${cr}, Narr: ${t.Narr}`);
      drSum += dr;
      crSum += cr;
    }
  });

  console.log(`Raw Total DR: ${drSum}`);
  console.log(`Raw Total CR: ${crSum}`);
  console.log(`Difference: ${drSum - crSum}`);
}

run();
