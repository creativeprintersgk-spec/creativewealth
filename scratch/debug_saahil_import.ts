import * as fs from 'fs';
import * as path from 'path';
import csvParser from 'csv-parser';

const CSV_DIR = path.join(process.cwd(), 'scratch', 'mprofit_csv');

function parseCSV(fileName: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const rows: any[] = [];
    const filePath = path.join(CSV_DIR, fileName);
    if (!fs.existsSync(filePath)) { resolve([]); return; }
    fs.createReadStream(filePath)
      .pipe(csvParser({ mapHeaders: ({ header }) => header.trim().replace(/^\uFEFF/, '') }))
      .on('data', (d) => rows.push(d))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

async function debug() {
  const vouchersRaw = await parseCSV('Vouchers1.csv');
  console.log(`Total vouchers in Vouchers1.csv: ${vouchersRaw.length}`);
  
  const vids = new Set<string>();
  const dupVids = new Map<string, any[]>();
  
  for (const v of vouchersRaw) {
    if (vids.has(v.VID)) {
      if (!dupVids.has(v.VID)) {
        // Find the first one to add to list
        const first = vouchersRaw.find(x => x.VID === v.VID);
        dupVids.set(v.VID, [first]);
      }
      dupVids.get(v.VID)!.push(v);
    }
    vids.add(v.VID);
  }
  
  console.log(`Duplicate VIDs count: ${dupVids.size}`);
  if (dupVids.size > 0) {
    console.log('Examples of duplicate VIDs:');
    let count = 0;
    for (const [vid, list] of dupVids.entries()) {
      if (count++ < 3) {
        console.log(`\nVID: ${vid}`);
        list.forEach(v => {
          console.log(`  ACID: ${v.ACID}, DT: ${v.DT}, NARR: ${v.NARR.slice(0, 50)}`);
        });
      }
    }
  }
}

debug().catch(console.error);
