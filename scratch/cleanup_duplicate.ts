import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function cleanup() {
  const duplicateId = 'bf7d51d2-b5df-44ce-91a4-391ff5b02493';
  
  console.log(`\n🧹 DELETING GHOST VOUCHER: ${duplicateId}`);
  
  // 1. Double check it has no entries
  const { data: entries } = await supabase.from('entries').select('id').eq('voucher_id', duplicateId);
  if (entries && entries.length > 0) {
    console.error('❌ ABORTING: Voucher has entries! We should not delete it.');
    return;
  }

  // 2. Delete the voucher
  const { error } = await supabase.from('vouchers').delete().eq('id', duplicateId);
  
  if (error) {
    console.error('❌ ERROR DELETING:', error);
  } else {
    console.log('✅ SUCCESS: Duplicate deleted.');
  }
}

cleanup();
