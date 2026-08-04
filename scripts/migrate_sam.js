import { createClient } from '@supabase/supabase-js';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const folder = 'C:\\\\Users\\\\Admin\\\\Desktop\\\\MasterDb';
const dbsToProcess = [
  'MPrMasterDbAMFI.db',
  'MPrMasterDbBSE.db',
  'MPrMasterDbBonds.db'
];

async function run() {
  console.log("Starting Migration...");
  
  // We'll store everything in a Map keyed by `amid` to deduplicate
  const samMap = new Map();

  for (const dbName of dbsToProcess) {
    const dbPath = path.join(folder, dbName);
    if (!fs.existsSync(dbPath)) {
      console.warn(`File not found: ${dbPath}`);
      continue;
    }
    
    console.log(`Reading from ${dbName}...`);
    const db = new Database(dbPath, { readonly: true });
    
    const rows = db.prepare('SELECT * FROM SAM').all();
    console.log(`Found ${rows.length} rows in ${dbName}`);
    
    for (const row of rows) {
      // Map columns from uppercase to lowercase for Supabase
      const record = {
        amid: row.AMID,
        anm: row.ANM,
        atyp: row.ATYP,
        grp: row.GRP,
        exint1: row.EXINT1,
        extstr: row.EXTSTR,
        exint2: row.EXINT2,
        isr: row.ISR,
        alias: row.ALIAS
      };
      // Overwrite any existing entry with the same AMID
      samMap.set(record.amid, record);
    }
    db.close();
  }

  const allRecords = Array.from(samMap.values());
  console.log(`\nTotal unique SAM records to upload: ${allRecords.length}`);

  // Push to Supabase in batches of 1000
  const BATCH_SIZE = 1000;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
    const batch = allRecords.slice(i, i + BATCH_SIZE);
    process.stdout.write(`Uploading batch ${i / BATCH_SIZE + 1} of ${Math.ceil(allRecords.length / BATCH_SIZE)}... `);
    
    const { data, error } = await supabase
      .from('sam')
      .upsert(batch, { onConflict: 'amid' });

    if (error) {
      console.log(`❌ ERROR: ${error.message}`);
      errorCount += batch.length;
    } else {
      console.log(`✅ OK`);
      successCount += batch.length;
    }
  }

  console.log("\n--- Migration Complete ---");
  console.log(`Successfully upserted: ${successCount}`);
  console.log(`Failed: ${errorCount}`);
}

run().catch(console.error);
