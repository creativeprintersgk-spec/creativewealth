import * as fs from 'fs';
import * as path from 'path';
import csvParser from 'csv-parser';

const CSV_DIR = path.join(process.cwd(), 'scratch', 'mprofit_csv');

function parseCSV(fileName: string): Promise<any[]> {
  return new Promise((resolve) => {
    const rows: any[] = [];
    const filePath = path.join(CSV_DIR, fileName);
    if (!fs.existsSync(filePath)) { resolve([]); return; }
    fs.createReadStream(filePath)
      .pipe(csvParser({ mapHeaders: ({ header }) => header.trim().replace(/^\uFEFF/, '') }))
      .on('data', d => rows.push(d))
      .on('end', () => resolve(rows));
  });
}

async function debug() {
  const acmac = await parseCSV('ACMAC1.csv');
  const mappings = await parseCSV('Mappings.csv');
  const sam = await parseCSV('SAM.csv');
  const acLedger = await parseCSV('AcLEdgerMappings1.csv');
  
  console.log('ACMAC1.csv count:', acmac.length);
  if (acmac.length > 0) {
    console.log('ACMAC1 Headers:', Object.keys(acmac[0]));
    console.log('ACMAC1 Sample:', acmac.slice(0, 3));
    
    // Check if ID 230 or 401 is in ACMAC1
    console.log('Is 230 in ACMAC1?', acmac.filter(r => r.ID === '230' || r.MAID === '230'));
  }
  
  console.log('\nMappings.csv count:', mappings.length);
  if (mappings.length > 0) {
    console.log('Mappings Headers:', Object.keys(mappings[0]));
    console.log('Mappings Sample:', mappings.slice(0, 3));
  }
  
  console.log('\nSAM.csv count:', sam.length);
  if (sam.length > 0) {
    console.log('SAM Headers:', Object.keys(sam[0]));
    console.log('SAM Sample:', sam.slice(0, 3));
    console.log('Is 230 in SAM.csv?', sam.filter(r => r.ID === '230' || r.MAID === '230'));
  }

  console.log('\nAcLEdgerMappings1.csv count:', acLedger.length);
  if (acLedger.length > 0) {
    console.log('AcLEdgerMappings1 Headers:', Object.keys(acLedger[0]));
    console.log('AcLEdgerMappings1 Sample:', acLedger.slice(0, 3));
  }
}

debug().catch(console.error);
