import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
import fs from 'fs';
import csvParser from 'csv-parser';

async function parseCSV(fileName) {
  return new Promise((resolve) => {
    const rows = [];
    fs.createReadStream('scratch/mprofit_csv/' + fileName)
      .pipe(csvParser({ mapHeaders: ({ header }) => header.trim().replace(/^\uFEFF/, '') }))
      .on('data', d => rows.push(d))
      .on('end', () => resolve(rows));
  });
}

async function run() {
  const acma = await parseCSV('ACMA1.csv');
  const acmaIds = new Set(acma.map(a => a.ID));
  const trans = await parseCSV('Trans1.csv');
  
  function ledgerId(maid, extid) {
    if (acmaIds.has(maid)) return 'ldgr_acma_' + maid;
    if (extid === '-1') return 'ldgr_asset_' + maid;
    if (extid === '-5') return 'ldgr_broker_' + maid;
    return 'ldgr_other_' + maid;
  }
  
  const allLedgerIds = new Set(trans.map(t => ledgerId(t.MAID, t.EXTID)));
  
  // fetch existing from supabase
  const { data: dbLedgers } = await supabase.from('ledgers').select('id');
  const dbIds = new Set(dbLedgers.map(l => l.id));
  
  const missing = [...allLedgerIds].filter(id => !dbIds.has(id));
  console.log('Missing ledgers:', missing.slice(0, 20));
}
run();
