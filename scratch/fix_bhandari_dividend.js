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
  console.log('Fixing bs1 entry for acvch = 13330...');
  
  const { data, error } = await supabase
    .from('bs1')
    .update({
      trty: 62,
      trstr: 'Dividend Payout',
      amt: 200000
    })
    .eq('acvch', 13330)
    .select();

  if (error) {
    console.error('Error updating bs1:', error);
  } else {
    console.log('Successfully updated bs1:', data);
  }
}

run().catch(console.error);
