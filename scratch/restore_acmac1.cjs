const fs = require('fs');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

function mapHeaderToColumn(header) {
  let col = header.trim().replace(/^\uFEFF/, "").toLowerCase().replace('\r', '');
  
  const mappings = {
    "id": "id",
    "extid": "ext_id",
    "parent_id": "parent_id",
    "parent_extid": "parent_ext_id",
    "is_group": "is_group",
    "name": "name",
    "disp_seqno": "disp_seqno",
    "descr": "descr",
    "flags": "flags",
    "acid": "acid",
    "clid": "clid",
    "isitledger": "is_it_ledger",
    "specialtypeid": "special_type_id",
    "cr_bal": "cr_bal",
    "db_bal": "db_bal",
    "treenode": "tree_node",
    "addr": "addr",
    "pan": "pan",
    "addinfo": "addinfo"
  };
  
  return mappings[col] || col;
}

async function restoreAcmac1() {
  console.log('Reading ACMAC1.csv...');
  
  const rows = [];
  
  await new Promise((resolve, reject) => {
    fs.createReadStream('scratch/mprofit_csv/ACMAC1.csv')
      .pipe(csv({
        mapHeaders: ({ header }) => mapHeaderToColumn(header)
      }))
      .on('data', (data) => {
        const obj = {};
        for (const [k, v] of Object.entries(data)) {
           let val = v;
           if (val === 'NULL' || val === '') val = null;
           obj[k] = val;
        }
        
        if (obj.is_group === '1' || obj.is_group === 'True' || obj.is_group === 'true') {
          obj.is_group = true;
        } else {
          obj.is_group = false;
        }
        
        if (obj.id) obj.id = Number(obj.id);
        if (obj.parent_id) obj.parent_id = Number(obj.parent_id);
        if (obj.acid) obj.acid = Number(obj.acid);
        if (obj.special_type_id) obj.special_type_id = Number(obj.special_type_id);
        
        rows.push(obj);
      })
      .on('end', () => resolve())
      .on('error', reject);
  });
  
  console.log(`Parsed ${rows.length} rows from CSV.`);
  if (rows.length > 0) {
     console.log('Sample row:', rows[0]);
  }
  
  console.log('Deleting existing rows in acmac1...');
  const { error: deleteError } = await supabase.from('acmac1').delete().neq('id', -999999);
  if (deleteError) {
    console.error('Failed to delete old rows:', deleteError);
    return;
  }
  console.log('Old rows deleted successfully.');
  
  console.log('Inserting restored rows...');
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    let batch = rows.slice(i, i + 500);
    const { error: insertError } = await supabase.from('acmac1').insert(batch);
    if (insertError) {
      console.error(`Failed to insert batch ${i}:`, insertError.message);
      
      // Auto-strip missing columns
      if (insertError.message.includes('Could not find the')) {
         let match = insertError.message.match(/Could not find the '([^']+)' column/);
         let currentBatch = batch;
         while (match) {
            const missingCol = match[1];
            console.log(`Stripping missing column '${missingCol}' and retrying...`);
            currentBatch = currentBatch.map(r => {
               const newR = { ...r };
               delete newR[missingCol];
               return newR;
            });
            const retryRes = await supabase.from('acmac1').insert(currentBatch);
            if (retryRes.error) {
               if (retryRes.error.message.includes('Could not find the')) {
                   match = retryRes.error.message.match(/Could not find the '([^']+)' column/);
               } else {
                   console.error('Retry failed with different error:', retryRes.error);
                   break;
               }
            } else {
               inserted += currentBatch.length;
               console.log(`Inserted batch ${i} to ${i + currentBatch.length} (${inserted}/${rows.length}) after retries`);
               break;
            }
         }
      }
    } else {
      inserted += batch.length;
      console.log(`Inserted batch ${i} to ${i + batch.length} (${inserted}/${rows.length})`);
    }
  }
  
  console.log('Restore complete!');
}

restoreAcmac1().catch(console.error);
