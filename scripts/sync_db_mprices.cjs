require('dotenv').config();
const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');

const SQLITE_FILE = "C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db";
const BATCH_SIZE = 1000;

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

async function run() {
  const db = new Database(SQLITE_FILE, { readonly: true });
  console.log("Truncating mprices...");
  await supabase.rpc('exec_sql', { query: `TRUNCATE TABLE public.mprices CASCADE;` });

  const chunkArray = (array, size) => {
    const chunked = [];
    let index = 0;
    while (index < array.length) {
      chunked.push(array.slice(index, size + index));
      index += size;
    }
    return chunked;
  };

  const rows = db.prepare(`SELECT * FROM "MPrices"`).all();
  let formattedRows = rows.map(row => {
    const formatted = {};
    for (const [key, value] of Object.entries(row)) {
      formatted[key.toLowerCase()] = value;
    }
    for (const key of Object.keys(formatted)) {
      if (typeof formatted[key] === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(formatted[key])) {
        const parts = formatted[key].split('-');
        formatted[key] = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    return formatted;
  });

  let success = false;
  while (!success && Object.keys(formattedRows[0]).length > 0) {
    const batches = chunkArray(formattedRows, BATCH_SIZE);
    let totalInserted = 0;
    let batchError = null;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const { error } = await supabase.from('mprices').insert(batch);
      if (error) {
        batchError = error;
        break;
      } else {
        totalInserted += batch.length;
        process.stdout.write(`\rInserted ${totalInserted}/${rows.length} rows...`);
      }
    }

    if (batchError) {
      if (batchError.code === 'PGRST204') {
        const match = batchError.message.match(/Could not find the '([^']+)' column/);
        if (match && match[1]) {
          const badCol = match[1];
          formattedRows = formattedRows.map(r => {
            const newR = { ...r };
            delete newR[badCol];
            return newR;
          });
          continue;
        }
      }
      console.error(`\nError:`, batchError);
      break;
    } else {
      success = true;
      console.log(`\nFinished mprices.`);
    }
  }
}
run().catch(console.error);
