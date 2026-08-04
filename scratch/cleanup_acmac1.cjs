const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function cleanupAcmac1() {
  console.log('Fetching all acmac1 rows...');
  let allRows = [];
  let from = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase.from('acmac1').select('*').range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    from += pageSize;
  }
  
  console.log(`Fetched ${allRows.length} rows.`);
  
  const uniqueRowsMap = new Map();
  // To avoid duplicates, we use a compound key: id
  for (const row of allRows) {
    // some rows might have identical ID but different data? Let's check if there are different rows with the same id
    // In MProfit, 'id' is the primary key for acmac1.
    if (!uniqueRowsMap.has(row.id)) {
      uniqueRowsMap.set(row.id, row);
    }
  }
  
  const uniqueRows = Array.from(uniqueRowsMap.values());
  console.log(`Found ${uniqueRows.length} unique rows by ID.`);
  
  if (allRows.length === uniqueRows.length) {
    console.log('No duplicates found based on ID.');
    return;
  }
  
  console.log('Deleting all existing rows in acmac1...');
  const { error: deleteError } = await supabase.from('acmac1').delete().neq('id', -999999);
  if (deleteError) {
    console.error('Failed to delete:', deleteError);
    return;
  }
  
  console.log('Inserting unique rows back...');
  for (let i = 0; i < uniqueRows.length; i += 500) {
    const batch = uniqueRows.slice(i, i + 500);
    const { error: insertError } = await supabase.from('acmac1').insert(batch);
    if (insertError) {
      console.error('Failed to insert batch:', insertError);
    } else {
      console.log(`Inserted batch ${i} to ${i + batch.length}`);
    }
  }
  
  console.log('Cleanup of acmac1 complete.');
}

cleanupAcmac1().catch(console.error);
