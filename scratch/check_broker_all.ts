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
  const all230 = trans.filter(t => t.MAID === '230' || t.EXTID === '230');
  
  console.log(`Total rows with 230 as MAID or EXTID: ${all230.length}`);

  const extids = new Set(all230.map(t => t.EXTID));
  console.log('Unique EXTIDs for MAID = 230:', Array.from(extids));

  // Find other broker codes in ACMA1.csv or Trans1.csv
  const acma = await parseCSV('ACMA1.csv');
  const brokersInAcma = acma.filter(a => a.NAME && a.NAME.toLowerCase().includes('broker'));
  console.log('\n--- Brokers in ACMA1 ---');
  brokersInAcma.forEach(b => {
    console.log(`ID: ${b.ID}, Name: ${b.NAME}, ParentGroup: ${b.PARENT_ID}`);
  });
}

run();
