require('dotenv').config();
const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const localDb = new Database('C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db');

const masterDbs = [
  { file: 'MPrMasterDbBonds.db', table: 'SAM', mapCol: 'ANM' },
  { file: 'MPrMasterDbAMFI.db', table: 'SAM', mapCol: 'ANM' },
  { file: 'MPrMasterDbBSE.db', table: 'SAM', mapCol: 'ANM' },
  { file: 'MPrMasterDbFAO.db', table: 'SAM', mapCol: 'ANM' },
  { file: 'MPrMasterDbForex.db', table: 'SAM', mapCol: 'ANM' },
  { file: 'MPrMasterCategDb.db', table: 'ASUBTYP', mapCol: 'NAME' }
];

async function run() {
  console.log('Finding missing AMIDs...');
  // Find AMIDs in local DB that do not exist in acmac1 or sam
  const missingRows = localDb.prepare(`
    SELECT DISTINCT AMID FROM SumTable 
    WHERE AMID NOT IN (SELECT ID FROM ACMAC1) 
      AND AMID NOT IN (SELECT AMID FROM SAM)
  `).all();
  
  const missingAmids = missingRows.map(r => r.AMID);
  console.log(`Found ${missingAmids.length} missing AMIDs in SumTable.`);

  // Check how many are missing in Supabase asset_master
  // Since we have 841 missing AMIDs, we'll fetch existing ones from Supabase to filter them out
  const batchSize = 100;
  let existingAmids = new Set();
  
  for(let i=0; i < missingAmids.length; i += batchSize) {
    const chunk = missingAmids.slice(i, i+batchSize);
    const { data } = await supabase.from('asset_master').select('amid').in('amid', chunk);
    if (data) data.forEach(d => existingAmids.add(d.amid));
  }

  const toFetch = missingAmids.filter(id => !existingAmids.has(id));
  console.log(`${toFetch.length} AMIDs need to be fetched from MasterDb.`);

  const foundAssets = [];

  for (const mdb of masterDbs) {
    try {
      const m = new Database(`C:/Users/Admin/Desktop/MasterDb/${mdb.file}`);
      for (const id of toFetch) {
         try {
           const res = m.prepare(`SELECT * FROM ${mdb.table} WHERE AMID = ?`).get(id);
           if (res) {
             foundAssets.push({
               amid: res.AMID,
               name: res[mdb.mapCol],
               asset_type: res.ATYP || 0,
               asset_type_name: mdb.file.includes('Bonds') ? 'Bonds' : 
                                mdb.file.includes('AMFI') ? 'Mutual Funds' : 
                                mdb.file.includes('BSE') ? 'Stocks' : 'Other'
             });
           }
         } catch(e) {}
      }
    } catch(e) {
      console.log(`Could not open ${mdb.file}`);
    }
  }

  console.log(`Found ${foundAssets.length} asset details in MasterDb!`);
  
  // Insert into Supabase
  if (foundAssets.length > 0) {
    const { error } = await supabase.from('asset_master').upsert(foundAssets, { onConflict: 'amid' });
    if (error) console.error('Error inserting into asset_master:', error);
    else console.log('Successfully inserted missing assets into Supabase!');
  }
}

run();
