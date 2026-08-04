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
  console.log('=== Inspecting acc_pflink table ===');
  const { data, error } = await supabase.from('acc_pflink').select('*');
  if (error) {
    console.error('Error fetching acc_pflink:', error.message);
  } else {
    console.log(`acc_pflink contains ${data?.length} rows:`);
    console.log(data);
  }
}

run().catch(console.error);
