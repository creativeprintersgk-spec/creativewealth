import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const vidsToDelete = [10043, 10426, 10427];
  
  console.log(`Deleting vouchers: ${vidsToDelete.join(', ')}`);
  
  // 1. Delete from trans1
  const { data: delTrans, error: errTrans } = await supabase
      .from('trans1')
      .delete()
      .in('vid', vidsToDelete)
      .select();
      
  if (errTrans) {
      console.error('Error deleting from trans1:', errTrans.message);
  } else {
      console.log(`Deleted ${delTrans?.length || 0} line items from trans1.`);
  }

  // 2. Delete from vouchers1
  const { data: delVouch, error: errVouch } = await supabase
      .from('vouchers1')
      .delete()
      .in('vid', vidsToDelete)
      .select();
      
  if (errVouch) {
      console.error('Error deleting from vouchers1:', errVouch.message);
  } else {
      console.log(`Deleted ${delVouch?.length || 0} headers from vouchers1.`);
  }
  
  // 3. Delete from bs1 (just in case they are there, though usually these are manual JVs)
  const { data: delBs1, error: errBs1 } = await supabase
      .from('bs1')
      .delete()
      .in('acvch', vidsToDelete)
      .select();
      
  if (errBs1) {
      console.error('Error deleting from bs1:', errBs1.message);
  } else {
      console.log(`Deleted ${delBs1?.length || 0} entries from bs1.`);
  }
}

run().catch(console.error);
