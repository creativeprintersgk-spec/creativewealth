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
  const acma = await parseCSV('ACMA1.csv');
  
  // Find ID = 230
  const maid230 = acma.find(a => a.ID && a.ID.trim() === '230');
  console.log('ID 230 in ACMA1.csv:', maid230);

  // Print all acma rows where ID is 14, 27, 230, etc.
  const targetIds = ['14', '27', '230', '11', '13', '16', '52'];
  const targets = acma.filter(a => targetIds.includes(a.ID && a.ID.trim()));
  console.log('\n--- TARGET LEDGERS ---');
  targets.forEach(t => {
    console.log(`ID: ${t.ID}, Name: ${t.NAME}, ParentGroup: ${t.PARENT_ID}`);
  });
}

run();
