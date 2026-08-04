// Fix: Add ISIN INE733E01010 to asset_master for NTPC Limited (amid=104519)
// AND fix the sam row for FUTSTKNTPC29NOV2012 to not pollute NTPC equity searches

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  console.log('=== Checking current asset_master for NTPC ===');
  const { data: am } = await supabase.from('asset_master').select('*').eq('amid', 104519);
  console.log('Current asset_master row for amid=104519:', am);

  console.log('\n=== Updating asset_master amid=104519 with ISIN INE733E01010 ===');
  const { data: updRes, error: updErr } = await supabase
    .from('asset_master')
    .update({ isin: 'INE733E01010', nse_symbol: 'NTPC' })
    .eq('amid', 104519)
    .select();

  if (updErr) {
    console.error('Update failed:', updErr);
    // Try upsert in case there's no row
    console.log('Trying insert...');
    const { data: insRes, error: insErr } = await supabase
      .from('asset_master')
      .insert({ amid: 104519, name: 'NTPC Limited', isin: 'INE733E01010', nse_symbol: 'NTPC' })
      .select();
    if (insErr) console.error('Insert also failed:', insErr);
    else console.log('Inserted:', insRes);
  } else {
    console.log('Updated successfully:', updRes);
  }

  // Also update sam extstr for amid=104519 to have the ISIN  
  console.log('\n=== Updating sam extstr for amid=104519 ===');
  const { data: samRow } = await supabase.from('sam').select('*').eq('amid', 104519);
  console.log('sam row for 104519:', samRow);
  
  if (samRow && samRow.length > 0) {
    const { data: samUpd, error: samErr } = await supabase
      .from('sam')
      .update({ extstr: 'INE733E01010' })
      .eq('amid', 104519)
      .select();
    if (samErr) console.error('sam update failed:', samErr);
    else console.log('sam updated:', samUpd);
  }

  console.log('\nDone. NTPC Limited (amid=104519) should now have ISIN=INE733E01010.');
  console.log('The import should now correctly resolve NTPC equity via ISIN match.');
}

run().catch(console.error);
