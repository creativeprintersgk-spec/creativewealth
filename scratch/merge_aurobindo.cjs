const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

// Merge: CN created amid=253975 for Aurobindo, but existing holdings use amid=102791
// Fix: remap the bs1 row from 253975 -> 102791
// Then update asset_master 102791 to have isin + proper NSE symbol

async function mergeAurobindo() {
  console.log('Merging Aurobindo: CN amid=253975 -> existing amid=102791\n');

  // Step 1: Update bs1 row(s) that use the CN's amid=253975 to use amid=102791
  const { error: bsErr, data: bsData } = await supabase
    .from('bs1')
    .update({ amid: 102791 })
    .eq('amid', 253975)
    .select('trid, pfid, amid, qn, purpr, dt');
  
  if (bsErr) {
    console.error('Error updating bs1:', bsErr);
  } else {
    console.log('✅ Remapped bs1 rows from amid=253975 -> 102791:', JSON.stringify(bsData, null, 2));
  }

  // Step 2: Update acmac1 ledger rows that map to amid=253975 -> 102791
  // The ledger was created with exint1=253975, update to 102791
  const { error: ledErr, data: ledData } = await supabase
    .from('acmac1')
    .update({ exint1: 102791 })
    .eq('exint1', 253975)
    .select('id, name, exint1');
  
  if (ledErr) {
    console.error('Error updating acmac1:', ledErr.message);
  } else {
    console.log('✅ Updated acmac1 exint1 253975->102791:', JSON.stringify(ledData, null, 2));
  }

  // Step 3: Delete the now-unused amid=253975 from asset_master
  // (only safe if no other bs1 rows still reference it)
  const { data: remainingBs } = await supabase
    .from('bs1')
    .select('trid')
    .eq('amid', 253975)
    .limit(1);
  
  if (!remainingBs || remainingBs.length === 0) {
    const { error: delErr } = await supabase
      .from('asset_master')
      .delete()
      .eq('amid', 253975);
    if (delErr) {
      console.error('Error deleting amid=253975:', delErr.message);
    } else {
      console.log('✅ Deleted stale amid=253975 from asset_master');
    }
  } else {
    console.log('⚠️ Still has bs1 rows for amid=253975, not deleting');
  }

  // Step 4: Update sum_table - delete any stale entry for 253975 and recalculate 102791
  const { error: sumDelErr } = await supabase
    .from('sum_table')
    .delete()
    .eq('amid', 253975);
  if (sumDelErr) { console.error('sum_table delete:', sumDelErr.message); }
  else { console.log('✅ Cleaned sum_table entry for amid=253975'); }

  console.log('\nDone! Aurobindo is now unified under amid=102791.');
  console.log('Refresh PMS Workspace to see a single Aurobindo Pharma row.');
}

mergeAurobindo().catch(console.error);
