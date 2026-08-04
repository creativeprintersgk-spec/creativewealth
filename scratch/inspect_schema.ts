import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  const { data: info, error } = await supabase.from('bs1').select('*').limit(1);
  if (error) {
    console.error('Error fetching bs1:', error.message);
    return;
  }
  if (info && info.length > 0) {
    console.log('Sample row from bs1:', info[0]);
    console.log('Types of keys:');
    for (const key of Object.keys(info[0])) {
      console.log(`  ${key}: ${typeof info[0][key]} (value: ${info[0][key]})`);
    }
  } else {
    console.log('No rows found in bs1.');
  }
}

run().catch(console.error);
