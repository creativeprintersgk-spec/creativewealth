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
  console.log('Updating transids 22876 and 22878 to point to maid 500589 in transc1...');

  const { data: update1, error: error1 } = await supabase
    .from('transc1')
    .update({ maid: 500589 })
    .eq('transid', 22876)
    .select();

  if (error1) {
    console.error('Error updating transid 22876:', error1);
  } else {
    console.log('Updated transid 22876 successfully:', update1);
  }

  const { data: update2, error: error2 } = await supabase
    .from('transc1')
    .update({ maid: 500589 })
    .eq('transid', 22878)
    .select();

  if (error2) {
    console.error('Error updating transid 22878:', error2);
  } else {
    console.log('Updated transid 22878 successfully:', update2);
  }
}

run().catch(console.error);
