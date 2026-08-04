import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import csvParser from 'csv-parser';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const CSV_PATH = path.join(process.cwd(), 'scratch', 'mprofit_csv', 'MPrices.csv');

function parseDate(d: string): string | null {
  if (!d) return null;
  const parts = d.trim().split('-');
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

function parseCSV(): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const rows: any[] = [];
    if (!fs.existsSync(CSV_PATH)) {
      reject(new Error(`File not found: ${CSV_PATH}`));
      return;
    }
    fs.createReadStream(CSV_PATH)
      .pipe(csvParser({ mapHeaders: ({ header }) => header.trim() }))
      .on('data', (d) => rows.push(d))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

async function main() {
  console.log('🚀 Starting MPrices.csv import to Supabase...');
  try {
    const rawRows = await parseCSV();
    console.log(`Parsed ${rawRows.length} rows from MPrices.csv`);

    // Map rows to match Supabase database schema
    const formattedRows = rawRows.map((r: any) => {
      const date = parseDate(r.Date);
      return {
        source_id_atyp: Number(r.SourceID_ATYP) || 0,
        amid: Number(r.AMID) || 0,
        currp: r.CURRP && r.CURRP.trim() !== '' ? parseFloat(r.CURRP) : null,
        prevp: r.PREVP && r.PREVP.trim() !== '' ? parseFloat(r.PREVP) : null,
        date: date
      };
    }).filter(r => r.amid > 0 && r.date !== null);

    // Read backup to preserve today's synced prices
    const backupPath = path.join(process.cwd(), 'scratch', 'supabase_mprices_backup.json');
    if (fs.existsSync(backupPath)) {
      try {
        const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        const todayRows = backupData.filter((r: any) => r.date === '2026-05-26');
        console.log(`Found ${todayRows.length} rows for 2026-05-26 in backup. Merging...`);
        todayRows.forEach((r: any) => {
          formattedRows.push({
            source_id_atyp: r.source_id_atyp,
            amid: r.amid,
            currp: r.currp,
            prevp: r.prevp,
            date: r.date
          });
        });
      } catch (e: any) {
        console.warn('Could not load backup file:', e.message);
      }
    }

    console.log(`Formatted ${formattedRows.length} valid rows for upload.`);

    console.log('Clearing existing mprices table in Supabase...');
    const { error: delErr } = await supabase.from('mprices').delete().neq('row_id', -1);
    if (delErr) {
      console.error('❌ Failed to clear mprices table:', delErr.message);
      return;
    }
    console.log('✅ Existing mprices cleared.');

    // Upload in batches of 200
    const BATCH_SIZE = 200;
    console.log(`Uploading prices in batches of ${BATCH_SIZE}...`);
    for (let i = 0; i < formattedRows.length; i += BATCH_SIZE) {
      const chunk = formattedRows.slice(i, i + BATCH_SIZE);
      const { error: insErr } = await supabase.from('mprices').insert(chunk);
      if (insErr) {
        console.error(`❌ Error inserting batch [${i} to ${i + chunk.length}]:`, insErr.message);
      } else {
        console.log(`  Uploaded batch ${i} to ${i + chunk.length}`);
      }
    }
    console.log('✅ MPrices.csv import completed successfully!');
  } catch (err: any) {
    console.error('❌ Import failed:', err.message || err);
  }
}

main().catch(console.error);
